import { eq, and, lte, inArray } from "drizzle-orm";
import { documentProcessingJobs } from "./config/schema";
import db from "./config/db";
import { processFile } from "./doc-processor";
import { DocumentProcessor } from "./doc-processor-v2";

const CONCURRENT_JOBS = 1;
const POLLING_INTERVAL = 10000; // 10 seconds
const MAX_ATTEMPTS = 2;

// Track active jobs
let activeJobs = new Set<number>();

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
 * Synchronize job processing to ensure only one batch (up to CONCURRENT_JOBS)
 * is run at a time.
 */
let isProcessingBatch = false;
async function processNextBatch() {
  // Only pick up new jobs if we're below the concurrent limit
  if (activeJobs.size >= CONCURRENT_JOBS) {
    return;
  }

  try {
    return await db.transaction(async (tx) => {
      // Query enough jobs to fill up to CONCURRENT_JOBS
      const slotsAvailable = CONCURRENT_JOBS - activeJobs.size;
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
        .limit(slotsAvailable)
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

      // Process each job independently
      jobs.forEach((job) => {
        activeJobs.add(job.id);
        processJob(job).finally(() => {
          activeJobs.delete(job.id);
          // Try to process more jobs when one finishes
          processNextBatch();
        });
      });
    });
  } finally {
    isProcessingBatch = false;
  }
}

async function processJob(job: typeof documentProcessingJobs.$inferSelect) {
  try {
    // await processFile(job.fileKey, job.fileName, job.mimeType, job.documentId);
    const docProcessor = new DocumentProcessor(
      job.fileKey,
      job.fileName,
      job.mimeType,
      job.documentId,
      true
    );
    const result = await docProcessor.processAndEmbed();
    console.log(result);

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
