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
  url: string;
};

export class ArtifactService {
  constructor(private threadId: string) {}

  private normalizeFilename(filename: string): string {
    // Replace various whitespace characters (including narrow no-break space \u202f,
    // tabs, multiple spaces) with a single standard space. Also, trim leading/trailing whitespace.
    return filename.replace(/[\s\u202f]+/g, " ").trim();
  }

  /**
   * Saves an artifact to S3
   * If an artifact with the same filename already exists, it will be overwritten.
   * @param filename The unique identifier for the artifact.
   * @param artifact The artifact data (bytes and MIME type).
   */
  async saveArtifact(
    filename: string,
    artifact: ArtifactData,
    triggerEvent: boolean = true
  ): Promise<void> {
    try {
      const normalizedFilename = this.normalizeFilename(filename);
      const fileKey = `files/threads/${this.threadId}/${normalizedFilename}`;
      await s3
        .file(fileKey, {
          type: artifact.mimeType,
        })
        .write(artifact.data);
    } catch (error) {
      console.error("Failed to save artifact:", error);
      throw error;
    }
  }

  /**
   * Loads an artifact from S3
   * @param filename The unique identifier for the artifact.
   * @returns The artifact data if found, otherwise undefined.
   */
  async loadArtifact(filename: string): Promise<ArtifactData | undefined> {
    try {
      const normalizedFilename = this.normalizeFilename(filename);
      const fileKey = `files/threads/${this.threadId}/${normalizedFilename}`;
      const file = s3.file(fileKey);
      if (await file.exists()) {
        const stat = await file.stat();
        const data = await file.arrayBuffer();
        return {
          data: new Uint8Array(data),
          mimeType: stat.type,
        };
      } else {
        return undefined;
      }
    } catch (error) {
      console.error("Failed to load artifact:", error);
      throw error;
    }
  }

  /**
   * Lists the filenames of all artifacts currently stored in memory.
   * @returns An array of artifact filenames.
   */
  async listArtifacts(): Promise<string[]> {
    try {
      const keys = await s3.list({
        prefix: `files/threads/${this.threadId}/`,
      });
      return keys.contents?.map((obj) => obj.key.split("/").pop() ?? "") ?? [];
    } catch (error) {
      console.error("Failed to list artifacts:", error);
      throw error;
    }
  }

  /**
   * Deletes an artifact from the in-memory storage.
   * @param filename The unique identifier for the artifact.
   * @returns True if the artifact was deleted, false if it wasn't found.
   */
  async deleteArtifact(filename: string): Promise<boolean> {
    try {
      const normalizedFilename = this.normalizeFilename(filename);
      await s3
        .file(`files/threads/${this.threadId}/${normalizedFilename}`)
        .delete();
      return true;
    } catch (error) {
      console.error("Failed to delete artifact:", error);
      throw error;
    }
  }

  /**
   * Clears all artifacts from S3
   */
  async clearArtifacts(): Promise<void> {
    try {
      const keys = await this.listArtifacts();
      for (const key of keys) {
        await this.deleteArtifact(key);
      }
    } catch (error) {
      console.error("Failed to clear artifacts:", error);
      throw error;
    }
  }

  /**
   * Get all artifacts from S3 storage path of the workflow run.
   * @returns An array of artifacts.
   */
  async getArtifacts(): Promise<Record<string, ArtifactData>> {
    try {
      const keys = await this.listArtifacts();
      const artifacts = await Promise.all(
        keys.map(async (key) => {
          const artifact = await this.loadArtifact(key);
          return [key, artifact];
        })
      );
      return Object.fromEntries(artifacts);
    } catch (error) {
      console.error("Failed to get artifacts:", error);
      throw error;
    }
  }

  /**
   * Copies an existing S3 object into the artifact storage for this step,
   * effectively "adopting" it without re-uploading the data.
   * @param sourceKey The full S3 key of the object to copy.
   * @param targetFilename The desired filename for the artifact within this step.
   * @param mimeType The MIME type of the object being copied.
   */
  async adoptS3Object(
    sourceKey: string,
    targetFilename: string,
    mimeType: string
  ): Promise<void> {
    const normalizedTargetFilename = this.normalizeFilename(targetFilename);
    const targetKey = `files/threads/${this.threadId}/${normalizedTargetFilename}`;
    try {
      const sourceFile = s3.file(sourceKey);
      if (!(await sourceFile.exists())) {
        throw new Error(`Source object ${sourceKey} not found for adoption.`);
      }
      const data = await sourceFile.arrayBuffer();

      const targetFile = s3.file(targetKey);
      await targetFile.write(data, {
        type: mimeType,
      });

      //   await sourceFile.delete(); // can't delete because its break the workflow input value file url
    } catch (error) {
      console.error(
        `Failed to adopt S3 object from ${sourceKey} to ${targetKey}:`,
        error
      );
      throw error;
    }
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
        "Creates an artifact in the artifact service. Use this to save substantial, self-contained content like documents, code, diagrams, or data that users might modify or reuse.",
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

        // Return artifact data for frontend display
        return {
          success: true,
          message: `Successfully created artifact '${fileName}' with MIME type '${mimeType}'.`,
          // Frontend artifact data
          identifier: fileName.replace(/\.[^/.]+$/, ""), // Remove file extension for identifier
          type: mimeType,
          title: fileName,
          content: data,
          created: new Date().toISOString(),
        };
      },
    });
  }

  /**
   * Gets all the artifact management tools associated with this service instance,
   * mapped by tool name.
   * @returns An object where keys are tool names and values are Tool objects.
   */
  public getTools(): Record<string, Tool> {
    return {
      //   "list-artifacts": this.listArtifactsTool(),
      //   "load-artifact": this.loadArtifactTool(),
      create_artifact: this.createArtifactTool(),
    };
  }
}
