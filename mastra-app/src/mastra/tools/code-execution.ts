import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { Sandbox } from "@e2b/code-interpreter";

export type CodeExecutionContext = {
  sandbox: Sandbox;
};

export const codeExecutionTool = createTool({
  id: "Code Execution",
  description: `This tool allows you to execute code within a secure sandbox environment. The sandbox provides an isolated execution context where code can be run safely without affecting the host system. All code execution is contained and monitored, with access to stdout, stderr, and execution results.`,
  inputSchema: z.object({
    code: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
    results: z.array(z.any()),
    stdout: z.array(z.string()),
    stderr: z.array(z.string()),
    error: z.any().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const { code } = context;
    const sandbox = runtimeContext.get("sandbox") as Sandbox;

    console.log("--------------------------------");
    console.log(code);
    console.log("--------------------------------");

    const { text, results, logs, error } = await sandbox.runCode(code);

    console.log("--------------------------------");
    console.log(text);
    console.log(results);
    console.log(logs);
    console.log(error);
    console.log("--------------------------------");

    return {
      text: text ?? "",
      results: results,
      stdout: logs.stdout,
      stderr: logs.stderr,
      error,
    };
  },
});
