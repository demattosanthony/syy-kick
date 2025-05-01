import { Tool, tool } from "ai";
import { z } from "zod";
import s3 from "../../config/s3";

export type ArtifactData = {
  data: Uint8Array;
  mimeType: string;
};

export type ArtifactEvent = {
  type: "created";
  filename: string;
  mimeType: string;
  fileKey: string;
  stepId: string;
  ts: number;
};

export class ArtifactService {
  constructor(
    private workflowId: string,
    private workflowRunId: string,
    private workflowStepId: string,
    private onEvent?: (event: ArtifactEvent) => void
  ) {}

  /**
   * Saves an artifact to S3
   * If an artifact with the same filename already exists, it will be overwritten.
   * @param filename The unique identifier for the artifact.
   * @param artifact The artifact data (bytes and MIME type).
   */
  async saveArtifact(filename: string, artifact: ArtifactData): Promise<void> {
    const fileKey = `workflows/${this.workflowId}/${this.workflowRunId}/${this.workflowStepId}/${filename}`;
    await s3
      .file(fileKey, {
        type: artifact.mimeType,
      })
      .write(artifact.data);
    console.log(`Artifact '${filename}' saved, with file key: ${fileKey}`);
    this.onEvent?.({
      type: "created",
      filename,
      fileKey,
      mimeType: artifact.mimeType,
      stepId: this.workflowStepId,
      ts: Date.now(),
    });
  }

  /**
   * Loads an artifact from S3
   * @param filename The unique identifier for the artifact.
   * @returns The artifact data if found, otherwise undefined.
   */
  async loadArtifact(filename: string): Promise<ArtifactData | undefined> {
    const file = s3.file(
      `workflows/${this.workflowId}/${this.workflowRunId}/${this.workflowStepId}/${filename}`
    );
    if (await file.exists()) {
      console.log(`Artifact '${filename}' loaded.`);
    } else {
      console.log(`Artifact '${filename}' not found.`);
      return undefined;
    }
    const stat = await file.stat();
    const data = await file.arrayBuffer();
    return {
      data: new Uint8Array(data),
      mimeType: stat.type,
    };
  }

  /**
   * Lists the filenames of all artifacts currently stored in memory.
   * @returns An array of artifact filenames.
   */
  async listArtifacts(): Promise<string[]> {
    const keys = await s3.list({
      prefix: `workflows/${this.workflowId}/${this.workflowRunId}/${this.workflowStepId}/`,
    });
    console.log(
      "Listing artifacts:",
      keys.contents?.map((obj) => obj.key)
    );
    return keys.contents?.map((obj) => obj.key.split("/").pop() ?? "") ?? [];
  }

  /**
   * Deletes an artifact from the in-memory storage.
   * @param filename The unique identifier for the artifact.
   * @returns True if the artifact was deleted, false if it wasn't found.
   */
  async deleteArtifact(filename: string): Promise<boolean> {
    await s3
      .file(
        `workflows/${this.workflowId}/${this.workflowRunId}/${this.workflowStepId}/${filename}`
      )
      .delete();
    console.log(`Artifact '${filename}' deleted.`);
    return true;
  }

  /**
   * Clears all artifacts from the in-memory storage.
   */
  async clearArtifacts(): Promise<void> {
    const keys = await this.listArtifacts();
    for (const key of keys) {
      await this.deleteArtifact(key);
    }
    console.log("All artifacts cleared.");
  }

  /**
   * Get all artifacts from the in-memory storage.
   * @returns An array of artifacts.
   */
  async getArtifacts(): Promise<Record<string, ArtifactData>> {
    const keys = await this.listArtifacts();
    const artifacts = await Promise.all(
      keys.map(async (key) => {
        const artifact = await this.loadArtifact(key);
        return [key, artifact];
      })
    );
    return Object.fromEntries(artifacts);
  }

  // --- Tool Creation Methods (now private inside the class) ---

  private listArtifactsTool(): Tool {
    return tool({
      description: "Lists the filenames of all currently available artifacts.",
      parameters: z.object({}).describe("No parameters required."),
      execute: async () => {
        try {
          const filenames = await this.listArtifacts();
          return { filenames: filenames };
        } catch (error: any) {
          console.error("Error in listArtifactsTool:", error);
          return {
            success: false,
            message: `Failed to list artifacts: ${error.message}`,
          };
        }
      },
    });
  }

  private loadArtifactTool(): Tool {
    return tool({
      description:
        "Loads an artifact from the artifact service. This tool allows you to load an artifact into your context that you are then able to process and understand. This means loading a image will let you see the image, a pdf will let you see the pdf, and a csv will let you see the csv.",
      parameters: z.object({
        fileName: z.string().describe("The file name of the artifact to load."),
      }),
      execute: async ({ fileName }) => {
        const artifact = await this.loadArtifact(fileName);
        if (!artifact) {
          return {
            success: false,
            message: `Artifact '${fileName}' not found.`,
          };
        }

        // The actually loading gets done in the onStepFinishCallback

        return {
          success: true,
          message: `Successfully loaded artifact '${fileName}'.`,
          fileName: fileName,
          mimeType: artifact.mimeType,
        };
      },
    });
  }

  private createArtifactTool(): Tool {
    return tool({
      description:
        "Creates a text-based artifact in the artifact service. Saves textual data like Markdown, CSV, or plain text.",
      parameters: z.object({
        fileName: z
          .string()
          .describe(
            "The name of the artifact (e.g., 'report.md', 'data.csv')."
          ),
        mimeType: z
          .string()
          .describe("The MIME type (e.g., 'text/markdown', 'text/csv')."),
        data: z
          .string()
          .describe("The plain text content. Do not base64 encode."),
      }),
      execute: async ({ fileName, mimeType, data }) => {
        const artifactData = new TextEncoder().encode(data);
        await this.saveArtifact(fileName, {
          data: artifactData,
          mimeType,
        });

        return {
          success: true,
          message: `Successfully created artifact '${fileName}' with MIME type '${mimeType}'.`,
        };
      },
    });
  }

  /**
   * Gets all the artifact management tools associated with this service instance,
   * mapped by tool name.
   * @returns An object where keys are tool names and values are Tool objects.
   */
  public getArtifactTools(): Record<string, Tool> {
    return {
      "list-artifacts": this.listArtifactsTool(),
      "load-artifact": this.loadArtifactTool(),
      "create-artifact": this.createArtifactTool(),
    };
  }

  //   /** Dump all artifacts to debug-artifacts folder */
  //   async dumpArtifacts() {
  //     const dir = `debug-artifacts/${this.workflowId}/${this.workflowRunId}/${this.workflowStepId}`;
  //     // Ensure the directory exists (this might need a library or platform-specific API in a real scenario)
  //     // For Bun, you might need to handle directory creation manually if Bun.write doesn't create parent dirs.
  //     try {
  //       // Basic check/creation - replace with more robust logic if needed
  //       if (!existsSync(dir)) {
  //         mkdirSync(dir, { recursive: true });
  //       }
  //     } catch (e) {
  //       console.warn(`Could not ensure debug directory ${dir} exists:`, e);
  //     }

  //     const artifacts = await this.getArtifacts();
  //     for (const [filename, artifact] of Object.entries(artifacts)) {
  //       const filePath = `${dir}/${filename}`;
  //       try {
  //         await Bun.write(filePath, artifact.data);
  //       } catch (e) {
  //         console.error(
  //           `Failed to write artifact ${filename} to ${filePath}:`,
  //           e
  //         );
  //       }
  //     }
  //   }
}
