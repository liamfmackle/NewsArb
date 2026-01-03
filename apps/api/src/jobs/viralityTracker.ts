import { updateAllActiveVirality } from "../services/virality.js";

// Interval in milliseconds (15 minutes)
const VIRALITY_UPDATE_INTERVAL = 15 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the virality tracking background job
 */
export function startViralityTracker(): void {
  if (intervalId) {
    console.log("Virality tracker already running");
    return;
  }

  console.log(
    `Starting virality tracker (interval: ${VIRALITY_UPDATE_INTERVAL / 1000 / 60} minutes)`
  );

  // Run immediately on start
  runViralityUpdate();

  // Then run on interval
  intervalId = setInterval(runViralityUpdate, VIRALITY_UPDATE_INTERVAL);
}

/**
 * Stop the virality tracking background job
 */
export function stopViralityTracker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Virality tracker stopped");
  }
}

/**
 * Run a single virality update cycle
 */
async function runViralityUpdate(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running virality update...`);

  try {
    const result = await updateAllActiveVirality();
    console.log(
      `[${new Date().toISOString()}] Virality update complete: ${result.updated} stories updated, ${result.errors} errors`
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Virality update failed:`, error);
  }
}

/**
 * Check if the tracker is running
 */
export function isTrackerRunning(): boolean {
  return intervalId !== null;
}
