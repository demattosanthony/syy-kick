import { eq, and, lte, inArray } from "drizzle-orm";
import { documentProcessingJobs } from "./config/schema";
import db from "./config/db";
import { processFile } from "./doc-processor";

const CONCURRENT_JOBS = 5;
const POLLING_INTERVAL = 10000; // 10 seconds
const MAX_ATTEMPTS = 2;

export async function addToQueue(data: {
  fileKey: string;
  fileName: string;
  mimeType: string;
  documentId: string;
}) {
  await db.insert(documentProcessingJobs).values({
    ...data,
    status: "pending",
    maxAttempts: MAX_ATTEMPTS,
  });
}

/**
 * Synchronize job processing to ensure only one batch (up to 5)
 * is run at a time.
 */
let isProcessingBatch = false;
async function processNextBatch() {
  // Don't pick up a new batch if we're still
  // processing a previous one.
  if (isProcessingBatch) {
    return;
  }
  isProcessingBatch = true;

  try {
    return await db.transaction(async (tx) => {
      // Query up to CONCURRENT_JOBS pending jobs in a transaction
      const jobs = await tx
        .select()
        .from(documentProcessingJobs)
        .where(
          and(
            eq(documentProcessingJobs.status, "pending"),
            lte(documentProcessingJobs.processAfter, new Date()),
            lte(
              documentProcessingJobs.attempts,
              documentProcessingJobs.maxAttempts
            )
          )
        )
        .limit(CONCURRENT_JOBS)
        .$dynamic()
        .prepare(`FOR UPDATE SKIP LOCKED`)
        .execute();

      if (jobs.length === 0) return;

      // Mark them as processing
      await tx
        .update(documentProcessingJobs)
        .set({
          status: "processing",
          processAfter: new Date(),
        })
        .where(
          inArray(
            documentProcessingJobs.id,
            jobs.map((j) => j.id)
          )
        );

      // Process each job outside the transaction—await them
      // so that the next batch won't start until these 5 are done
      await Promise.all(jobs.map((job) => processJob(job)));
    });
  } finally {
    isProcessingBatch = false;
  }
}

async function processJob(job: typeof documentProcessingJobs.$inferSelect) {
  try {
    await processFile(job.fileKey, job.fileName, job.mimeType, job.documentId);

    // Mark as completed
    await db
      .update(documentProcessingJobs)
      .set({ status: "completed" })
      .where(eq(documentProcessingJobs.id, job.id));
  } catch (error) {
    // Handle failure with exponential backoff
    const nextAttempt = new Date();
    nextAttempt.setMinutes(
      nextAttempt.getMinutes() + Math.pow(2, job.attempts)
    );

    await db
      .update(documentProcessingJobs)
      .set({
        status: "pending",
        attempts: job.attempts + 1,
        lastError: error instanceof Error ? error.message : String(error),
        processAfter: nextAttempt,
      })
      .where(eq(documentProcessingJobs.id, job.id));

    // If max attempts reached, mark as failed
    if (job.attempts + 1 >= job.maxAttempts) {
      await db
        .update(documentProcessingJobs)
        .set({ status: "failed" })
        .where(eq(documentProcessingJobs.id, job.id));
    }
  }
}

// Cleanup old completed jobs periodically
async function cleanupOldJobs() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await db
    .delete(documentProcessingJobs)
    .where(
      and(
        eq(documentProcessingJobs.status, "completed"),
        lte(documentProcessingJobs.createdAt, thirtyDaysAgo)
      )
    );
}

// Reset processing jobs that are stuck, used when the server restarts
async function resetProcessingJobs() {
  await db
    .update(documentProcessingJobs)
    .set({
      status: "pending",
      processAfter: new Date(),
    })
    .where(eq(documentProcessingJobs.status, "processing"));
}

let isStarted = false;
let processInterval: ReturnType<typeof setInterval>;
let cleanupInterval: ReturnType<typeof setInterval>;

export async function startQueue() {
  if (isStarted) return;
  isStarted = true;

  // Reset any jobs that were left in "processing" state from previous shutdown
  await resetProcessingJobs();

  // Process jobs
  processInterval = setInterval(processNextBatch, POLLING_INTERVAL);

  // Cleanup old jobs daily
  cleanupInterval = setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);
}

export async function stopQueue() {
  if (!isStarted) return;
  isStarted = false;

  // Clear intervals
  clearInterval(processInterval);
  clearInterval(cleanupInterval);

  // Reset any currently processing jobs back to pending
  await resetProcessingJobs();
}

export const queue = {
  addToQueue,
  startQueue,
  stopQueue,
};
