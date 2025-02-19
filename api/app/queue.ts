import { eq, and, lte, sql } from "drizzle-orm";
import { documentProcessingJobs } from "./config/schema";
import db from "./config/db";
import { processFile } from "./config/unstructured";

const CONCURRENT_JOBS = 10;
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

async function processNextBatch() {
  // Use a transaction to safely get and lock jobs
  return await db.transaction(async (tx) => {
    // Get next batch of jobs with FOR UPDATE SKIP LOCKED
    // This prevents multiple servers/processes from picking up the same jobs
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

    // Mark selected jobs as processing
    await tx
      .update(documentProcessingJobs)
      .set({
        status: "processing",
        processAfter: new Date(),
      })
      .where(sql`id = ANY(ARRAY[${jobs.map((j) => j.id)}]::integer[])`);

    // Process jobs outside transaction
    for (const job of jobs) {
      processJob(job).catch(console.error);
    }
  });
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

let isStarted = false;

export function startQueue() {
  if (isStarted) return;
  isStarted = true;

  // Process jobs
  setInterval(processNextBatch, POLLING_INTERVAL);

  // Cleanup old jobs daily
  setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);
}

// Start the queue
startQueue();

export const queue = {
  addToQueue,
  startQueue,
};
