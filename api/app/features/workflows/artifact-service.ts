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
}

export function createListArtifactsTool(
  artifactService: ArtifactService
): Tool {
  return tool({
    description: "Lists the filenames of all currently available artifacts.",
    parameters: z.object({}).describe("No parameters required."),
    execute: async () => {
      try {
        const filenames = artifactService.listArtifacts();
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

export function createLoadArtifactTool(artifactService: ArtifactService): Tool {
  return tool({
    description:
      "Loads an artifact from the artifact service. This tool allows you to read the contents of an artifact. For example, if you need to read the contents of a PDF file, you can use this tool to load the PDF file into your context. This also works for images and allows you to see the image in your context.",
    parameters: z.object({
      fileName: z.string().describe("The file name of the artifact to load."),
    }),
    execute: async ({ fileName }) => {
      const artifact = artifactService.loadArtifact(fileName);
      if (!artifact) {
        return {
          success: false,
          message: `Artifact '${fileName}' not found.`,
        };
      }

      return {
        success: true,
        message: `Successfully loaded artifact '${fileName}'.`,
      };
    },
  });
}

export function createCreateArtifactTool(
  artifactService: ArtifactService
): Tool {
  return tool({
    description:
      "Creates a text-based artifact in the artifact service. This is useful for saving textual data like Markdown documents, CSV files, or plain text notes. For example, you could use this to save extracted text, generated reports, or structured data.",
    parameters: z.object({
      fileName: z
        .string()
        .describe(
          "The name of the artifact to create (e.g., 'report.md', 'data.csv')."
        ),
      mimeType: z
        .string()
        .describe(
          "The MIME type of the artifact (e.g., 'text/markdown', 'text/csv', 'text/plain')."
        ),
      data: z
        .string()
        .describe(
          "The text content of the artifact. Do not base64 encode this data; provide it as a plain string."
        ),
    }),
    execute: async ({ fileName, mimeType, data }) => {
      // Convert the plain text string data to a Uint8Array for storage
      const artifactData = new TextEncoder().encode(data);

      artifactService.saveArtifact(fileName, {
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
