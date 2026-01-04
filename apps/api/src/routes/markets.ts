import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { deleteCache } from "../lib/redis.js";
import { settleMarket } from "../jobs/settlementChecker.js";

const stakeSchema = z.object({
  amount: z.number().min(0.01),
});

export async function marketsRoutes(fastify: FastifyInstance) {
  // Get market by ID
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        story: true,
        positions: {
          include: {
            user: {
              select: { id: true, displayName: true },
            },
          },
          orderBy: { entryTime: "asc" },
        },
      },
    });

    if (!market) {
      return reply.status(404).send({ message: "Market not found" });
    }

    return market;
  });

  // Stake on market (authenticated)
  fastify.post("/:id/stake", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = stakeSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input" });
    }

    const { amount } = result.data;
    const userId = (request as any).user.userId;

    // Get market
    const market = await prisma.market.findUnique({
      where: { id },
      include: { story: true },
    });

    if (!market) {
      return reply.status(404).send({ message: "Market not found" });
    }

    if (market.status !== "open") {
      return reply.status(400).send({ message: "Market is not open for staking" });
    }

    // Check user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < amount) {
      return reply.status(400).send({ message: "Insufficient balance" });
    }

    // Create position in transaction
    const position = await prisma.$transaction(async (tx) => {
      // Check for existing position
      const existingPosition = await tx.position.findFirst({
        where: { userId, marketId: id, status: "active" },
      });

      let pos;
      const currentPoolSize = market.totalPool;

      if (existingPosition) {
        // Add to existing position
        pos = await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            stakeAmount: { increment: amount },
            // Keep original entry pool size for payout calculation
          },
        });
      } else {
        // Create new position
        pos = await tx.position.create({
          data: {
            userId,
            marketId: id,
            stakeAmount: amount,
            entryPoolSize: currentPoolSize,
            status: "active",
          },
        });

        // Increment participant count
        await tx.market.update({
          where: { id },
          data: { participantCount: { increment: 1 } },
        });
      }

      // Update market pool
      await tx.market.update({
        where: { id },
        data: { totalPool: { increment: amount } },
      });

      // Deduct user balance
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: "stake",
          amount: -amount,
          referenceId: id,
        },
      });

      return pos;
    });

    // Invalidate cache
    await deleteCache("stories:1:10");

    return position;
  });

  // Settle market (admin only)
  fastify.post("/:id/settle", { preHandler: [(fastify as any).authenticateAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const market = await prisma.market.findUnique({
      where: { id },
    });

    if (!market) {
      return reply.status(404).send({ message: "Market not found" });
    }

    if (market.status !== "open") {
      return reply.status(400).send({ message: "Market already settled" });
    }

    // Use the centralized settlement function
    const result = await settleMarket(id, "admin_manual");

    if (!result.success) {
      return reply.status(500).send({ message: "Failed to settle market" });
    }

    return {
      message: "Market settled",
      distributablePool: result.distributablePool,
      platformFee: result.platformFee,
    };
  });
}
