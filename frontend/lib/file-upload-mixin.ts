import api from "./api";

// Define the entry interface for clarity
interface FileEntry {
  path: string;
  type: "folder" | "file";
  fileKey?: string;
  mimeType?: string;
  size?: number;
  sha256?: string;
}

export class FileUploadMixin {
  private readonly LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
  private readonly CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Calculate SHA-256 hash of a file
   */
  protected async calculateSha256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Generate file and folder entries from a list of files
   */
  protected async generateEntriesFromFileList(
    files: File[],
    resourceId: string,
    resourceType: "projects" | "knowledge-bases"
  ): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    const seenFolders = new Set<string>();

    for (const file of files) {
      const filePath =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      const parts = filePath.split("/").filter(Boolean);

      // Add folder entries
      for (let i = 0; i < parts.length - 1; i++) {
        const folderPath = parts.slice(0, i + 1).join("/");
        if (!seenFolders.has(folderPath)) {
          seenFolders.add(folderPath);
          entries.push({ path: folderPath, type: "folder" });
        }
      }

      // Add file entry
      const sha256 = await this.calculateSha256(file);
      const fileKey = `${resourceType}/${resourceId}/${sha256}`;
      entries.push({
        path: filePath,
        type: "file",
        fileKey,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        sha256,
      });
    }

    return entries;
  }

  /**
   * Upload a large file in chunks
   */
  protected async uploadLargeFile(
    file: File,
    uploadUrl: string,
    onProgress?: (loaded: number) => void
  ): Promise<void> {
    const chunks = Math.ceil(file.size / this.CHUNK_SIZE);
    let uploadedBytes = 0;

    for (let i = 0; i < chunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkSize = end - start;

      const headers = {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
      };

      let retries = 3;
      while (retries > 0) {
        try {
          const response = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: chunk,
          });
          if (!response.ok)
            throw new Error(`Upload failed: ${response.status}`);

          // Update progress with only the size of this chunk
          uploadedBytes += chunkSize;
          onProgress?.(uploadedBytes);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, (3 - retries) * 1000)
          );
        }
      }
    }
  }

  /**
   * Upload a regular file
   */
  protected async uploadRegularFile(
    file: File,
    uploadUrl: string,
    onProgress?: (loaded: number) => void
  ): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    onProgress?.(file.size);
  }

  /**
   * Prepare files for upload and return the data needed for the API request
   */
  public async prepareFilesForUpload(
    resourceId: string,
    resourceType: "projects" | "knowledge-bases",
    files: File[],
    basePath: string = "",
    onProgress?: (progress: number) => void
  ): Promise<{ basePath: string; entries: FileEntry[] }> {
    const entries = await this.generateEntriesFromFileList(
      files,
      resourceId,
      resourceType
    );

    let uploadedBytes = 0;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    // Upload each file
    for (const entry of entries) {
      if (entry.type === "file" && entry.fileKey) {
        const rawFile = files.find((f) => {
          const relPath =
            (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
            f.name;
          return relPath === entry.path;
        });

        if (!rawFile) {
          console.warn(
            `No matching File object for path: ${entry.path}, skipping.`
          );
          continue;
        }

        // Get presigned URL for upload
        const { url: uploadUrl } = await api.uploads.getPresignedUrl(
          rawFile.name,
          rawFile.type,
          rawFile.size,
          entry.fileKey
        );

        // Upload file based on size
        if (rawFile.size >= this.LARGE_FILE_THRESHOLD) {
          // For large files, track progress incrementally by chunk
          let fileUploadedBytes = 0;
          await this.uploadLargeFile(rawFile, uploadUrl, (fileBytes) => {
            // Calculate the delta of bytes uploaded in this chunk
            const delta = fileBytes - fileUploadedBytes;
            fileUploadedBytes = fileBytes;

            // Update the total uploaded bytes
            uploadedBytes += delta;

            // Report progress as percentage of total
            if (totalBytes > 0) {
              onProgress?.((uploadedBytes / totalBytes) * 100);
            }
          });
        } else {
          // For small files, update progress after the full file is uploaded
          await this.uploadRegularFile(rawFile, uploadUrl);
          uploadedBytes += rawFile.size;

          if (totalBytes > 0) {
            onProgress?.((uploadedBytes / totalBytes) * 100);
          }
        }
      }
    }

    return { basePath, entries };
  }
}
