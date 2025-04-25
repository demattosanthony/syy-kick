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
