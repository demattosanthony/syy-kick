import { z } from "zod";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import type { WorkflowExecutionInputValues } from "../../types";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  inputNumber: z.object({
    type: z.literal("number"),
    label: z.literal("Input Number"),
    value: z.object({
      number: z.number(),
    }),
  }),
  inputString: z.object({
    type: z.literal("text"),
    label: z.literal("Input String"),
    value: z.object({
      text: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  summary: z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
});

// Step 1: Process the input number
const processNumberStep = createStep({
  id: "process-number",
  description: "Process the input number",
  inputSchema,
  outputSchema: z.object({
    processedNumber: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second timeout

    // Safely get the number value with proper type checking
    const inputNumberValue = inputData.inputNumber.value as { number: number };
    const inputNumber = inputNumberValue.number;

    return {
      processedNumber: {
        type: "number" as const,
        number: inputNumber * 2,
      },
    };
  },
});

// Step 2: Process the input string
const processStringStep = createStep({
  id: "process-string",
  description: "Process the input string",
  inputSchema,
  outputSchema: z.object({
    processedString: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 seconds timeout

    // Safely get the text value with proper type checking
    const inputStringValue = inputData.inputString.value as { text: string };
    const inputString = inputStringValue.text;

    return {
      processedString: {
        type: "text" as const,
        text: inputString.toUpperCase(),
      },
    };
  },
});

// Step 3: Combine processed inputs from parallel execution
const combineParallelOutputsStep = createStep({
  id: "combine-parallel-outputs",
  description: "Combine outputs from parallel steps",
  inputSchema: z.object({
    "process-number": z.object({
      processedNumber: z.object({
        type: z.literal("number"),
        number: z.number(),
      }),
    }),
    "process-string": z.object({
      processedString: z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
    }),
  }),
  outputSchema: z.object({
    combinedResult: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
    numberValue: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 1200)); // 1.2 seconds timeout

    const processedNumber = inputData["process-number"].processedNumber.number;
    const processedString = inputData["process-string"].processedString.text;

    return {
      combinedResult: {
        type: "text" as const,
        text: `Combined: ${processedString} (${processedNumber})`,
      },
      numberValue: {
        type: "number" as const,
        number: processedNumber,
      },
    };
  },
});

// Steps for conditional branching
const highValueStep = createStep({
  id: "high-value",
  description: "Process high value numbers",
  inputSchema: z.object({
    numberValue: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    combinedResult: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  outputSchema: z.object({
    result: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 800)); // 0.8 seconds timeout
    return {
      result: {
        type: "text" as const,
        text: `HIGH VALUE (${inputData.numberValue.number}): ${inputData.combinedResult.text}`,
      },
    };
  },
});

const lowValueStep = createStep({
  id: "low-value",
  description: "Process low value numbers",
  inputSchema: z.object({
    numberValue: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    combinedResult: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  outputSchema: z.object({
    result: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 700)); // 0.7 seconds timeout
    return {
      result: {
        type: "text" as const,
        text: `LOW VALUE (${inputData.numberValue.number}): ${inputData.combinedResult.text}`,
      },
    };
  },
});

// Step for looping
const incrementStep = createStep({
  id: "increment",
  description: "Increment a counter",
  inputSchema: z.object({
    counter: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    iterationText: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  outputSchema: z.object({
    counter: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    iterationText: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5 seconds timeout
    const currentCount = inputData.counter.number;
    const iterationText = inputData.iterationText.text;

    return {
      counter: {
        type: "number" as const,
        number: currentCount + 1,
      },
      iterationText: {
        type: "text" as const,
        text: `${iterationText} Iteration: ${currentCount + 1},`,
      },
    };
  },
});

// Prepare for loop step
const prepareLoopStep = createStep({
  id: "prepare-loop",
  description: "Prepare data for loop",
  inputSchema: z.object({
    result: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  outputSchema: z.object({
    counter: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    iterationText: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 600)); // 0.6 seconds timeout
    return {
      counter: {
        type: "number" as const,
        number: 0,
      },
      iterationText: {
        type: "text" as const,
        text: "Loop started. ",
      },
    };
  },
});

// Step to prepare data for foreach
const prepareForEachStep = createStep({
  id: "prepare-foreach",
  description: "Prepare data for foreach loop",
  inputSchema: z.object({
    counter: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    iterationText: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  outputSchema: z.array(
    z.object({
      item: z.object({
        type: z.literal("number"),
        number: z.number(),
      }),
      index: z.object({
        type: z.literal("number"),
        number: z.number(),
      }),
    })
  ),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 800)); // 0.8 seconds timeout
    const count = inputData.counter.number;

    // Create an array of items for foreach
    return Array.from({ length: count }, (_, i) => ({
      item: {
        type: "number" as const,
        number: i * 10,
      },
      index: {
        type: "number" as const,
        number: i,
      },
    }));
  },
});

// Step for foreach processing
const processForEachItemStep = createStep({
  id: "process-foreach-item",
  description: "Process each item in the foreach loop",
  inputSchema: z.object({
    item: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    index: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
  }),
  outputSchema: z.object({
    processedItem: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // 0.3 seconds timeout
    const item = inputData.item.number;
    const index = inputData.index.number;

    return {
      processedItem: {
        type: "text" as const,
        text: `Item ${index}: ${item} processed to ${item * 2}`,
      },
    };
  },
});

// Step to collect foreach results
const collectForEachResultsStep = createStep({
  id: "collect-foreach-results",
  description: "Collect and process foreach results",
  inputSchema: z.array(
    z.object({
      processedItem: z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
    })
  ),
  outputSchema: z.object({
    foreachSummary: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 900)); // 0.9 seconds timeout

    const summary = inputData.map((item) => item.processedItem.text).join("; ");

    return {
      foreachSummary: {
        type: "text" as const,
        text: `ForEach Summary: ${summary}`,
      },
    };
  },
});

// Final summary step
const finalSummaryStep = createStep({
  id: "final-summary",
  description: "Create final workflow summary",
  inputSchema: z.object({
    foreachSummary: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second timeout

    return {
      summary: {
        type: "text" as const,
        text: `Kitchen Sink Workflow Complete! Final output: ${inputData.foreachSummary.text}`,
      },
    };
  },
});

// Create a nested workflow for the looping section
const loopWorkflow = createWorkflow({
  id: "loop-workflow",
  inputSchema: z.object({
    result: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
  outputSchema: z.object({
    counter: z.object({
      type: z.literal("number"),
      number: z.number(),
    }),
    iterationText: z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  }),
})
  .then(prepareLoopStep)
  .dountil(
    incrementStep,
    async ({ inputData }) => inputData.counter.number >= 5
  )
  .commit();

// Map function to adapt branch output to match loop input
const mapForLoop = (branchOutput: any) => {
  console.log("Branch output received:", JSON.stringify(branchOutput, null, 2));

  // Create a valid result object regardless of input
  return {
    result: {
      type: "text" as const,
      text: "Processing branch output",
    },
  };
};

// Create the main kitchen sink workflow
export const kitchenSinkWorkflow = createWorkflow({
  id: "Kitchen Sink Workflow",
  description:
    "A workflow that demonstrates all features of the Mastra workflow engine. This workflow is used to test the workflow engine and its features.",
  inputSchema,
  outputSchema: finalStepOutputSchema,
})
  // 1. Parallel execution
  .parallel([processNumberStep, processStringStep])

  // 2. Combine results
  .then(combineParallelOutputsStep)

  // 3. Create a simpler branch step with just one condition
  .branch([
    [async () => false, highValueStep],
    [
      // Always take this path
      async () => true,
      lowValueStep,
    ],
  ])

  // 4. Nested workflow with loop - use map to connect branch output to loop input
  .map(mapForLoop)
  .then(loopWorkflow)

  // 5. Foreach loop
  .then(prepareForEachStep)
  .foreach(processForEachItemStep, { concurrency: 2 })
  .then(collectForEachResultsStep)

  // 6. Final summary
  .then(finalSummaryStep)
  .commit();
