import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
});

export async function usersRoutes(fastify: FastifyInstance) {
  // Get current user
  fastify.get("/me", { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const userId = (request as any).user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        walletAddress: true,
        balance: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    return user;
  });

  // Update current user
  fastify.patch("/me", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const result = updateProfileSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input", errors: result.error.flatten() });
    }

    const { displayName } = result.data;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined && { displayName }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        walletAddress: true,
        balance: true,
        kycStatus: true,
      },
    });

    return user;
  });

  // Get user's positions
  fastify.get("/me/positions", { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const userId = (request as any).user.userId;

    const positions = await prisma.position.findMany({
      where: { userId },
      include: {
        market: {
          include: {
            story: {
              select: {
                id: true,
                title: true,
                sourceDomain: true,
              },
            },
          },
        },
      },
      orderBy: { entryTime: "desc" },
    });

    // Flatten the response
    return positions.map((pos) => ({
      id: pos.id,
      userId: pos.userId,
      marketId: pos.marketId,
      stakeAmount: pos.stakeAmount,
      entryPoolSize: pos.entryPoolSize,
      entryTime: pos.entryTime,
      payoutAmount: pos.payoutAmount,
      status: pos.status,
      market: pos.market
        ? {
            id: pos.market.id,
            totalPool: pos.market.totalPool,
            status: pos.market.status,
          }
        : null,
      story: pos.market?.story || null,
    }));
  });

  // Get user's transactions
  fastify.get("/me/transactions", { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const userId = (request as any).user.userId;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return transactions;
  });

  // Link wallet address
  fastify.post("/me/wallet", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const { walletAddress } = request.body as { walletAddress: string };

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return reply.status(400).send({ message: "Invalid wallet address" });
    }

    // Check if wallet already linked to another account
    const existing = await prisma.user.findFirst({
      where: { walletAddress, id: { not: userId } },
    });

    if (existing) {
      return reply.status(409).send({ message: "Wallet already linked to another account" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { walletAddress },
      select: {
        id: true,
        email: true,
        displayName: true,
        walletAddress: true,
        balance: true,
      },
    });

    return user;
  });
}
