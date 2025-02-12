export const forceLfsExtensions = [
  ".rvt",
  ".rfa",
  ".dwg",
  ".dxf",
  ".nwd",
  ".ifc",
  ".skp",
  ".pts",
  ".las",
  ".fbx",
  ".obj",
  ".max",
  ".gbxml",
  ".osm",
  ".db",
  ".sqlite",
  ".mp4",
  ".mov",
  ".tiff",
  ".raw",
  ".pdf",
  ".ppt",
  ".pptx",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".vsd",
  ".vsdx",
  ".zip",
  ".rar",
  ".7z",
];
export const sizeThresholdMB = 25; // If file is bigger than 25 MB, we treat it as LFS

export function shouldUseLfs(filename: string, sizeInBytes: number): boolean {
  const extensionMatch = filename.toLowerCase().match(/\.[^.]*$/);
  const extension = extensionMatch ? extensionMatch[0] : "";

  // If the extension is explicitly in forced-LFS array:
  if (forceLfsExtensions.includes(extension)) {
    return true;
  }
  // If the file size is above threshold => LFS
  return sizeInBytes > sizeThresholdMB * 1024 * 1024;
}
