import os from "os";

export const markitdownMimeTypes = [
  //   "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "text/html",
  "text/csv",
  "application/json",
  "text/xml",
  "application/zip",
];

export const markitdown = async (input: string | Buffer, fileName: string) => {
  let filePath: string;
  let tempFile: string | null = null;

  if (Buffer.isBuffer(input)) {
    // Create temp file with random name and .pdf extension
    tempFile = `/tmp/${Date.now()}-${fileName}`;
    await Bun.write(tempFile, input);
    filePath = tempFile;
  } else {
    filePath = input;
  }
  console.log("filePath", filePath);
  const expandedPath = filePath.replace(/^~(?=$|\/|\\)/, os.homedir());

  try {
    const proc = Bun.spawn(["markitdown", expandedPath]);
    const output = await new Response(proc.stdout).text();
    return output;
  } finally {
    // Clean up temp file if one was created
    if (tempFile) {
      await Bun.file(tempFile).delete();
    }
  }
};

// const main = async () => {
//   // Expand the tilde to the actual home directory
//   const filePath = "~/taxes/2024/2024 W2.pdf";
//   const expandedPath = filePath.replace(/^~(?=$|\/|\\)/, os.homedir());
//   const output = await markitdown(expandedPath);
//   console.log(output);
// };

// main();
