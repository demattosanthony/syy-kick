import { startQueue, stopQueue } from "./doc-job-queue";
import { freeEncoders } from "./doc-processor";

// Start polling for and processing jobs in a dedicated worker process
console.log("Starting document job queue...");
startQueue();

// Handle shutdown signals
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Stopping queue...");
  try {
    await stopQueue();
    freeEncoders();
    console.log("Queue stopped successfully.");
  } catch (error) {
    console.error("Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Stopping queue...");
  try {
    await stopQueue();
    freeEncoders();
    console.log("Queue stopped successfully.");
  } catch (error) {
    console.error("Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
});
