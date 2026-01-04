import { prisma } from "../lib/prisma.js";
import { isViralityDecaying } from "../services/virality.js";
import { calculateKudos, resetWeeklyKudos } from "../services/kudos.js";

// Interval in milliseconds (15 minutes for kudos check)
const KUDOS_CHECK_INTERVAL = 15 * 60 * 1000;

// Weekly reset day (0 = Sunday)
const WEEKLY_RESET_DAY = 0;
const WEEKLY_RESET_HOUR = 0;

let checkIntervalId: NodeJS.Timeout | null = null;
let resetIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the kudos calculator background job
 */
export function startKudosCalculator(): void {
  if (checkIntervalId) {
    console.log("Kudos calculator already running");
    return;
  }

  console.log(
    `Starting kudos calculator (interval: ${KUDOS_CHECK_INTERVAL / 1000 / 60} minutes)`
  );

  // Run kudos check on interval
  checkIntervalId = setInterval(runKudosCheck, KUDOS_CHECK_INTERVAL);

  // Check for weekly reset every hour
  resetIntervalId = setInterval(checkWeeklyReset, 60 * 60 * 1000);
}

/**
 * Stop the kudos calculator background job
 */
export function stopKudosCalculator(): void {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  if (resetIntervalId) {
    clearInterval(resetIntervalId);
    resetIntervalId = null;
  }
  console.log("Kudos calculator stopped");
}

/**
 * Run a single kudos calculation check cycle
 * Finds stories with decaying virality and distributes kudos
 */
async function runKudosCheck(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running kudos check...`);

  try {
    // Get all active stories that haven't had kudos distributed yet
    const activeStories = await prisma.story.findMany({
      where: {
        status: "active",
        kudosDistributed: false,
      },
      select: {
        id: true,
        title: true,
        currentViralityScore: true,
        peakViralityScore: true,
      },
    });

    let processed = 0;
    let checked = 0;

    for (const story of activeStories) {
      checked++;

      // Check if virality is decaying
      const decayCheck = await isViralityDecaying(story.id);

      if (decayCheck.isDecaying) {
        console.log(
          `[Kudos] Story ${story.id} ("${story.title}") qualifies for kudos distribution: ${decayCheck.reason}`
        );

        try {
          const result = await calculateKudos(story.id);
          if (result.success) {
            processed++;
            console.log(
              `[Kudos] Distributed ${result.totalKudosDistributed} kudos to ${result.submissionsProcessed} discoverers`
            );
          }
        } catch (error) {
          console.error(`[Kudos] Failed to calculate kudos for story ${story.id}:`, error);
        }
      }
    }

    console.log(
      `[${new Date().toISOString()}] Kudos check complete: ${checked} stories checked, ${processed} processed`
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Kudos check failed:`, error);
  }
}

/**
 * Check if it's time for weekly kudos reset
 */
async function checkWeeklyReset(): Promise<void> {
  const now = new Date();

  // Check if it's the reset day and hour
  if (now.getDay() === WEEKLY_RESET_DAY && now.getHours() === WEEKLY_RESET_HOUR) {
    console.log(`[${new Date().toISOString()}] Running weekly kudos reset...`);

    try {
      const result = await resetWeeklyKudos();
      console.log(`[${new Date().toISOString()}] Weekly reset complete: ${result.usersReset} users`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Weekly reset failed:`, error);
    }
  }
}

/**
 * Manually trigger kudos distribution for a story (admin function)
 */
export async function manualKudosDistribution(storyId: string): Promise<{
  success: boolean;
  message: string;
  totalKudos?: number;
}> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, kudosDistributed: true, status: true },
  });

  if (!story) {
    return { success: false, message: "Story not found" };
  }

  if (story.kudosDistributed) {
    return { success: false, message: "Kudos already distributed for this story" };
  }

  const result = await calculateKudos(storyId);

  if (result.success) {
    return {
      success: true,
      message: `Distributed ${result.totalKudosDistributed} kudos to ${result.submissionsProcessed} discoverers`,
      totalKudos: result.totalKudosDistributed,
    };
  }

  return { success: false, message: "Failed to distribute kudos" };
}

/**
 * Check if the calculator is running
 */
export function isCalculatorRunning(): boolean {
  return checkIntervalId !== null;
}
