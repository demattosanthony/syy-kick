import { Tool, tool } from "ai";
import { z } from "zod";

export type ArtifactData = {
  data: Uint8Array;
  mimeType: string;
};

export class ArtifactService {
  // In memory storage for artifacts
  private storage: Map<string, ArtifactData> = new Map();

  /**
   * Saves an artifact to the in-memory storage.
   * If an artifact with the same filename already exists, it will be overwritten.
   * @param filename The unique identifier for the artifact.
   * @param artifact The artifact data (bytes and MIME type).
   */
  saveArtifact(filename: string, artifact: ArtifactData): void {
    this.storage.set(filename, artifact);
    console.log(`Artifact '${filename}' saved.`);
  }

  /**
   * Loads an artifact from the in-memory storage.
   * @param filename The unique identifier for the artifact.
   * @returns The artifact data if found, otherwise undefined.
   */
  loadArtifact(filename: string): ArtifactData | undefined {
    const artifact = this.storage.get(filename);
    if (artifact) {
      console.log(`Artifact '${filename}' loaded.`);
    } else {
      console.log(`Artifact '${filename}' not found.`);
    }
    return artifact;
  }

  /**
   * Lists the filenames of all artifacts currently stored in memory.
   * @returns An array of artifact filenames.
   */
  listArtifacts(): string[] {
    const keys = Array.from(this.storage.keys());
    console.log("Listing artifacts:", keys);
    return keys;
  }

  /**
   * Deletes an artifact from the in-memory storage.
   * @param filename The unique identifier for the artifact.
   * @returns True if the artifact was deleted, false if it wasn't found.
   */
  deleteArtifact(filename: string): boolean {
    const deleted = this.storage.delete(filename);
    if (deleted) {
      console.log(`Artifact '${filename}' deleted.`);
    } else {
      console.log(`Artifact '${filename}' not found for deletion.`);
    }
    return deleted;
  }

  // --- Tool Creation Methods (now private inside the class) ---

  private listArtifactsTool(): Tool {
    return tool({
      description: "Lists the filenames of all currently available artifacts.",
      parameters: z.object({}).describe("No parameters required."),
      execute: async () => {
        try {
          const filenames = this.listArtifacts();
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
        "Loads an artifact from the artifact service. Returns the artifact's filename, MIME type, and base64 encoded data.",
      parameters: z.object({
        fileName: z.string().describe("The file name of the artifact to load."),
      }),
      execute: async ({ fileName }) => {
        const artifact = this.loadArtifact(fileName);
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
        this.saveArtifact(fileName, {
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

  /** Dump all artifacts to debug-artifacts folder */
  dumpArtifacts() {
    for (const [filename, artifact] of this.storage.entries()) {
      const filePath = `debug-artifacts/${filename}`;
      Bun.write(filePath, artifact.data);
    }
  }
}
