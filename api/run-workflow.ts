import fetch from "node-fetch"; // Use node-fetch or remove if using native fetch
import s3 from "./app/config/s3";

const filePath =
  "/Users/anthonydemattos/syy-kick/workflows-dataset/window-door-gen/HALLCHRISTINALAYOUTPG7FLOORPRE313.pdf";
const fileBytes = await Bun.file(filePath).arrayBuffer();
const pdfBytes = new Uint8Array(fileBytes);

const fileKey = `testing/${crypto.randomUUID()}/test.pdf`;

await s3.file(fileKey).write(pdfBytes);

// --- Configuration ---
const API_BASE_URL = "http://localhost:4000"; // Adjust if your API runs elsewhere
const WORKFLOW_ID = "47746f40-271e-43c0-915c-13904c597d77";
// const AUTH_TOKEN = "YOUR_AUTH_TOKEN"; // Replace with your actual auth token
const FILE_DETAILS = {
  fileKey,
  mimeType: "application/pdf",
  filename: filePath.split("/").pop()!,
};
// --- End Configuration ---

interface WorkflowExecutionInputValue {
  type: "text" | "file" | "number";
  label: string;
  value:
    | { text: string }
    | { fileKey: string; mimeType: string; filename: string }
    | { number: number };
}

interface WorkflowExecutionInputValues {
  [inputId: string]: WorkflowExecutionInputValue;
}

interface CreateRunResponse {
  id: string; // Assuming the response contains the run ID like this
  // Add other fields if needed based on your actual API response
}

async function createWorkflowRun(
  workflowId: string,
  inputValues: WorkflowExecutionInputValues
): Promise<string> {
  const url = `${API_BASE_URL}/workflows/${workflowId}/runs`;
  console.log(`[1/3] Creating workflow run at ${url}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      //   Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ workflowId, inputValues }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create workflow run: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  const data: CreateRunResponse = (await response.json()) as CreateRunResponse;
  console.log(`   -> Workflow run created with ID: ${data.id}`);
  return data.id;
}

async function triggerWorkflowRun(
  workflowId: string,
  workflowRunId: string
): Promise<void> {
  const url = `${API_BASE_URL}/workflows/${workflowId}/runs/${workflowRunId}`;
  console.log(`[2/3] Triggering workflow run at ${url}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      //   Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  });

  if (response.status !== 202) {
    // Check for 202 Accepted
    const errorBody = await response.text();
    throw new Error(
      `Failed to trigger workflow run: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  const responseData = await response.json();
  console.log(`   -> Workflow run triggered successfully:`, responseData);
}

async function streamWorkflowEvents(
  workflowId: string,
  workflowRunId: string
): Promise<void> {
  const url = `${API_BASE_URL}/workflows/${workflowId}/runs/${workflowRunId}/events`;
  console.log(`[3/3] Streaming events from ${url}...`);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/event-stream",
        //   Authorization: `Bearer ${AUTH_TOKEN}`, // Add if auth is needed
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to connect to event stream: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    // Iterate over the stream using for await...of
    for await (const chunk of response.body) {
      // Explicitly treat chunk as Buffer for TextDecoder
      buffer += decoder.decode(chunk as Buffer, { stream: true });

      // Process complete messages in the buffer
      let boundaryIndex;
      while ((boundaryIndex = buffer.indexOf("\n\n")) >= 0) {
        const message = buffer.substring(0, boundaryIndex);
        buffer = buffer.substring(boundaryIndex + 2); // Skip the double newline

        if (message.startsWith(":")) {
          // Ignore keep-alive comments
          continue;
        }

        let eventType = "message";
        let eventData = "";

        const lines = message.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith("data:")) {
            eventData = line.substring(5).trim();
          }
        }

        if (eventData) {
          try {
            const parsedData = JSON.parse(eventData);
            console.log(`   -> Event [${eventType}]:`, parsedData);

            if (
              eventType === "workflow_complete" ||
              eventType === "workflow_error"
            ) {
              // Stream likely ends after these events anyway, but good to know
            }
          } catch (e) {
            console.error("   -> Failed to parse event data:", eventData, e);
          }
        }
      }
    }

    // Process any remaining data in the buffer after the stream ends
    if (buffer.trim()) {
      // This might happen if the stream ends without a final \n\n
      console.warn("   -> Processing remaining buffer data:", buffer);
      // Duplicate the parsing logic for the final chunk if necessary
      // (Often not needed if the server guarantees termination with \n\n)
    }
  } catch (error) {
    console.error("Error during event streaming:", error);
  } finally {
    console.log("   -> Event streaming finished.");
  }
}

async function main() {
  try {
    // Define the input values based on the first step's formSchema
    const inputValues: WorkflowExecutionInputValues = {
      "architectural-drawings": {
        type: "file",
        label: "Architectural Drawings",
        value: FILE_DETAILS,
      },
    };

    // 1. Create the run
    const workflowRunId = await createWorkflowRun(WORKFLOW_ID, inputValues);

    // Small delay before triggering, maybe helpful depending on your backend setup
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2. Trigger the run
    await triggerWorkflowRun(WORKFLOW_ID, workflowRunId);

    // Small delay before streaming, maybe helpful
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 3. Stream events
    await streamWorkflowEvents(WORKFLOW_ID, workflowRunId);

    console.log("Script finished successfully.");
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1); // Exit with error code
  }
}

main();
