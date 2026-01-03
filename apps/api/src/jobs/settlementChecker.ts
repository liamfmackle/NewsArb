import { prisma } from "../lib/prisma.js";
import { isViralityDecaying } from "../services/virality.js";
import { deleteCache } from "../lib/redis.js";

// Interval in milliseconds (15 minutes)
const SETTLEMENT_CHECK_INTERVAL = 15 * 60 * 1000;

// Platform fee rate
const PLATFORM_FEE_RATE = 0.05;

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the settlement checker background job
 */
export function startSettlementChecker(): void {
  if (intervalId) {
    console.log("Settlement checker already running");
    return;
  }

  console.log(
    `Starting settlement checker (interval: ${SETTLEMENT_CHECK_INTERVAL / 1000 / 60} minutes)`
  );

  // Run on interval (not immediately, wait for first virality update)
  intervalId = setInterval(runSettlementCheck, SETTLEMENT_CHECK_INTERVAL);
}

/**
 * Stop the settlement checker background job
 */
export function stopSettlementChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Settlement checker stopped");
  }
}

/**
 * Run a single settlement check cycle
 */
async function runSettlementCheck(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running settlement check...`);

  try {
    // Get all open markets with active stories
    const openMarkets = await prisma.market.findMany({
      where: { status: "open" },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            currentViralityScore: true,
            peakViralityScore: true,
          },
        },
      },
    });

    let settled = 0;
    let checked = 0;

    for (const market of openMarkets) {
      checked++;

      // Check if virality is decaying
      const decayCheck = await isViralityDecaying(market.storyId);

      if (decayCheck.isDecaying) {
        console.log(
          `[Settlement] Market ${market.id} qualifies for settlement: ${decayCheck.reason}`
        );

        try {
          await settleMarket(market.id, "virality_decay", decayCheck.reason);
          settled++;
        } catch (error) {
          console.error(`[Settlement] Failed to settle market ${market.id}:`, error);
        }
      }
    }

    console.log(
      `[${new Date().toISOString()}] Settlement check complete: ${checked} markets checked, ${settled} settled`
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Settlement check failed:`, error);
  }
}

/**
 * Settle a market and distribute payouts
 */
export async function settleMarket(
  marketId: string,
  reason: string,
  reasonDetail?: string
): Promise<{ success: boolean; distributablePool?: number; platformFee?: number }> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { positions: true },
  });

  if (!market) {
    console.error(`Market ${marketId} not found`);
    return { success: false };
  }

  if (market.status !== "open") {
    console.error(`Market ${marketId} is not open`);
    return { success: false };
  }

  // Calculate payouts
  const totalPool = market.totalPool;
  const platformFee = totalPool * PLATFORM_FEE_RATE;
  const distributablePool = totalPool - platformFee;

  // Calculate weights: weight = stake / entryPoolSize
  let totalWeight = 0;
  const positionWeights = market.positions.map((pos) => {
    const weight = pos.stakeAmount / pos.entryPoolSize;
    totalWeight += weight;
    return { ...pos, weight };
  });

  // Distribute pool proportionally
  await prisma.$transaction(async (tx) => {
    for (const pos of positionWeights) {
      const payout = (pos.weight / totalWeight) * distributablePool;

      // Update position
      await tx.position.update({
        where: { id: pos.id },
        data: {
          payoutAmount: payout,
          status: "paid_out",
        },
      });

      // Credit user balance
      await tx.user.update({
        where: { id: pos.userId },
        data: { balance: { increment: payout } },
      });

      // Record payout transaction
      await tx.transaction.create({
        data: {
          userId: pos.userId,
          type: "payout",
          amount: payout,
          referenceId: market.id,
        },
      });
    }

    // Record platform fee
    await tx.transaction.create({
      data: {
        userId: "platform",
        type: "fee",
        amount: platformFee,
        referenceId: market.id,
      },
    });

    // Update market status
    await tx.market.update({
      where: { id: marketId },
      data: {
        status: "settled",
        settledAt: new Date(),
        settlementReason: reasonDetail ? `${reason}: ${reasonDetail}` : reason,
      },
    });
  });

  // Invalidate cache
  await deleteCache("stories:1:10");

  console.log(
    `[Settlement] Market ${marketId} settled. Pool: ${totalPool}, Fee: ${platformFee}, Distributed: ${distributablePool}`
  );

  return { success: true, distributablePool, platformFee };
}

/**
 * Check if the checker is running
 */
export function isCheckerRunning(): boolean {
  return intervalId !== null;
}
