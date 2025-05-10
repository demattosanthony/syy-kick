import { tool } from "ai";
import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { ArtifactService } from "../../workflows/artifact-service";

export const createCodeExecutionTool = (artifactService: ArtifactService) =>
  tool({
    description: `Execute python code in a Jupyter notebook cell and return result.
Provide the files names that you want to load into the sandbox so you can use them in the code execution.
The files will be loaded to the path /home/user/{fileName} so use that path in your code when you need to use them.

Any files that you create place in the /home/user/output directory. After the tool call any files in the output directory will be saved to the artifact service.`,
    parameters: z.object({
      code: z.string().describe("The python code to execute in a single cell"),
      fileNames: z
        .array(z.string())
        .describe(
          "The names of the files to load into the sandbox. The files should be in the same directory as the code cell."
        ),
    }),
    execute: async ({ code, fileNames }) => {
      try {
        console.log(code, "<---- code");
        const sandbox = await Sandbox.create();

        // Load files into sandbox
        for (const fileName of fileNames) {
          const file = await artifactService.loadArtifact(fileName);
          if (file) {
            await sandbox.files.write(
              `/home/user/${fileName}`,
              new Blob([file.data])
            );
          }
        }

        // Create output directory
        await sandbox.files.makeDir("/home/user/output");

        const { text, results, logs, error } = await sandbox.runCode(code);
        // console.log(results, "<---- results");
        console.log(logs, "<---- logs");
        console.log(text, "<---- text");
        console.log(error, "<---- error");

        // Check for files in the output directory
        const outputFiles = await sandbox.files.list("/home/user/output");
        console.log(outputFiles, "<---- output files");
        for (const file of outputFiles) {
          // Read file content as Uint8Array
          const contentBytes = await sandbox.files.read(file.path, {
            format: "bytes",
          });

          // Infer MIME type from file extension (basic version)
          let mimeType = "application/octet-stream"; // Default MIME type
          const extension = file.name.split(".").pop()?.toLowerCase();
          if (extension) {
            switch (extension) {
              case "txt":
                mimeType = "text/plain";
                break;
              case "json":
                mimeType = "application/json";
                break;
              case "xml":
                mimeType = "application/xml";
                break;
              case "csv":
                mimeType = "text/csv";
                break;
              case "html":
                mimeType = "text/html";
                break;
              case "css":
                mimeType = "text/css";
                break;
              case "js":
                mimeType = "application/javascript";
                break;
              case "png":
                mimeType = "image/png";
                break;
              case "jpg":
              case "jpeg":
                mimeType = "image/jpeg";
                break;
              case "gif":
                mimeType = "image/gif";
                break;
              case "svg":
                mimeType = "image/svg+xml";
                break;
              case "pdf":
                mimeType = "application/pdf";
                break;
              // Add more common types as needed
            }
          }

          await artifactService.saveArtifact(file.name, {
            data: contentBytes, // Use the Uint8Array directly
            mimeType: mimeType,
          });
        }

        // Kill the sandbox
        await sandbox.kill();

        return {
          //   results,
          logs,
          text,
          error,
        };
      } catch (error) {
        console.error(`[CodeExecutionTool] Error processing ${code}:`, error);
        return {
          success: false,
          message: `Failed to execute code: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  });
