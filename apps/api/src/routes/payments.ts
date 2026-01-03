import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { z } from "zod";
import { prisma, Prisma } from "../lib/prisma.js";

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY && process.env.NODE_ENV === "production") {
  console.error("WARNING: STRIPE_SECRET_KEY not set - payments will be disabled");
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Supported currencies with their display info
const SUPPORTED_CURRENCIES = [
  { code: "usd", symbol: "$", name: "US Dollar", minAmount: 100 }, // $1.00 minimum
  { code: "eur", symbol: "€", name: "Euro", minAmount: 100 },
  { code: "gbp", symbol: "£", name: "British Pound", minAmount: 100 },
  { code: "cad", symbol: "CA$", name: "Canadian Dollar", minAmount: 100 },
  { code: "aud", symbol: "A$", name: "Australian Dollar", minAmount: 100 },
  { code: "jpy", symbol: "¥", name: "Japanese Yen", minAmount: 100 }, // ¥100 minimum (no decimals)
  { code: "chf", symbol: "CHF", name: "Swiss Franc", minAmount: 100 },
  { code: "nzd", symbol: "NZ$", name: "New Zealand Dollar", minAmount: 100 },
  { code: "sgd", symbol: "S$", name: "Singapore Dollar", minAmount: 100 },
  { code: "hkd", symbol: "HK$", name: "Hong Kong Dollar", minAmount: 100 },
] as const;

type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

const createCheckoutSchema = z.object({
  amount: z.number().positive().min(1), // Amount in smallest currency unit (cents for USD)
  currency: z.enum(SUPPORTED_CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]]),
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // Get supported currencies
  fastify.get("/currencies", async () => {
    return { currencies: SUPPORTED_CURRENCIES };
  });

  // Create checkout session (authenticated)
  fastify.post(
    "/checkout",
    { onRequest: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!stripe) {
        return reply.status(503).send({
          message: "Payment service unavailable. Stripe not configured.",
        });
      }

      const result = createCheckoutSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          message: "Invalid input",
          errors: result.error.flatten(),
        });
      }

      const { amount, currency } = result.data;
      const userId = (request as any).user.userId;

      // Find currency config
      const currencyConfig = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
      if (!currencyConfig) {
        return reply.status(400).send({ message: "Unsupported currency" });
      }

      // Validate minimum amount
      if (amount < currencyConfig.minAmount) {
        return reply.status(400).send({
          message: `Minimum deposit is ${currencyConfig.symbol}${currencyConfig.minAmount / 100}`,
        });
      }

      // Get user
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      try {
        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency,
                product_data: {
                  name: "NewsArb Wallet Deposit",
                  description: `Add funds to your NewsArb wallet`,
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          metadata: {
            userId,
            type: "wallet_deposit",
          },
          customer_email: user.email,
          success_url: `${process.env.FRONTEND_URL}/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/deposit/cancel`,
        });

        return {
          sessionId: session.id,
          url: session.url,
        };
      } catch (err: any) {
        fastify.log.error(err, "Stripe checkout session creation failed");
        return reply.status(500).send({
          message: "Failed to create checkout session",
        });
      }
    }
  );

  // Get checkout session status (authenticated)
  fastify.get(
    "/checkout/:sessionId",
    { onRequest: [(fastify as any).authenticate] },
    async (request, reply) => {
      if (!stripe) {
        return reply.status(503).send({
          message: "Payment service unavailable",
        });
      }

      const { sessionId } = request.params as { sessionId: string };
      const userId = (request as any).user.userId;

      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Verify the session belongs to this user
        if (session.metadata?.userId !== userId) {
          return reply.status(403).send({ message: "Access denied" });
        }

        return {
          status: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency,
        };
      } catch (err: any) {
        if (err.code === "resource_missing") {
          return reply.status(404).send({ message: "Session not found" });
        }
        throw err;
      }
    }
  );

  // Stripe webhook handler
  fastify.post(
    "/webhook",
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      if (!stripe) {
        return reply.status(503).send({ message: "Payment service unavailable" });
      }

      const sig = request.headers["stripe-signature"] as string;

      if (!sig) {
        return reply.status(400).send({ message: "Missing stripe-signature header" });
      }

      let event: Stripe.Event;

      try {
        // Use raw body for webhook signature verification
        const rawBody = (request as any).rawBody || request.body;
        const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

        if (STRIPE_WEBHOOK_SECRET) {
          event = stripe.webhooks.constructEvent(bodyStr, sig, STRIPE_WEBHOOK_SECRET);
        } else {
          // In development without webhook secret, parse directly (not recommended for production)
          fastify.log.warn("STRIPE_WEBHOOK_SECRET not set - skipping signature verification");
          event = JSON.parse(bodyStr) as Stripe.Event;
        }
      } catch (err: any) {
        fastify.log.error(err, "Webhook signature verification failed");
        return reply.status(400).send({ message: `Webhook Error: ${err.message}` });
      }

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          // Only process wallet deposits
          if (session.metadata?.type !== "wallet_deposit") {
            break;
          }

          const userId = session.metadata.userId;
          if (!userId) {
            fastify.log.error({ session: session.id }, "Missing userId in session metadata");
            break;
          }

          // Calculate deposit amount in USD equivalent
          // For non-USD currencies, we store the converted amount
          // In a production system, you'd use real exchange rates
          const amountInCents = session.amount_total || 0;
          const currency = session.currency || "usd";

          // Simple conversion to USD for balance (in production, use real rates)
          let usdAmount = amountInCents / 100;
          if (currency !== "usd") {
            // Approximate rates (in production, fetch real-time rates)
            const rates: Record<string, number> = {
              eur: 1.08,
              gbp: 1.27,
              cad: 0.74,
              aud: 0.65,
              jpy: 0.0067,
              chf: 1.13,
              nzd: 0.61,
              sgd: 0.74,
              hkd: 0.13,
            };
            usdAmount = (amountInCents / 100) * (rates[currency] || 1);
          }

          try {
            // Update user balance and create transaction in a single transaction
            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
              // Check if this session was already processed (idempotency)
              const existingTx = await tx.transaction.findFirst({
                where: {
                  userId,
                  type: "deposit",
                  referenceId: session.id,
                },
              });

              if (existingTx) {
                fastify.log.info({ sessionId: session.id }, "Deposit already processed");
                return;
              }

              // Update user balance
              await tx.user.update({
                where: { id: userId },
                data: { balance: { increment: usdAmount } },
              });

              // Create transaction record
              await tx.transaction.create({
                data: {
                  userId,
                  type: "deposit",
                  amount: usdAmount,
                  referenceId: session.id,
                },
              });

              fastify.log.info(
                { userId, amount: usdAmount, currency, sessionId: session.id },
                "Deposit processed successfully"
              );
            });
          } catch (err) {
            fastify.log.error(err, "Failed to process deposit");
            // Don't return error - Stripe will retry
          }
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          fastify.log.info({ sessionId: session.id }, "Checkout session expired");
          break;
        }

        default:
          fastify.log.info({ type: event.type }, "Unhandled webhook event type");
      }

      return { received: true };
    }
  );

  // Get user's deposit history (authenticated)
  fastify.get(
    "/deposits",
    { onRequest: [(fastify as any).authenticate] },
    async (request) => {
      const userId = (request as any).user.userId;

      const deposits = await prisma.transaction.findMany({
        where: {
          userId,
          type: "deposit",
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return { deposits };
    }
  );
}
