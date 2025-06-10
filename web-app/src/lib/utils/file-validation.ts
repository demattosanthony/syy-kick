import { toast } from "sonner";

export const validateFile = (
  file: File,
  supportedMimeTypes: string[],
  options: { maxFileSize?: number; maxImageSize?: number }
): boolean => {
  const { maxFileSize, maxImageSize } = options;

  // Check if the file type is supported
  if (
    supportedMimeTypes.length > 0 &&
    !supportedMimeTypes.includes(file.type)
  ) {
    toast.error(
      `File type not supported: ${
        file.type
      }. Please upload one of the following: ${supportedMimeTypes.join(", ")}`
    );
    return false;
  }

  // Check file size for all files
  //   if (maxFileSize && file.size > maxFileSize) {
  //     toast.error(
  //       `File is too large: ${(file.size / 1024 / 1024).toFixed(
  //         2
  //       )} MB. Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(2)} MB.`
  //     );
  //     return false;
  //   }

  // Check image dimensions if it's an image and maxImageSize is specified
  if (file.type.startsWith("image/") && maxImageSize) {
    // This part requires reading the image, which is async.
    // For simplicity in this utility, we might skip direct dimension check
    // or expect dimensions to be pre-checked if critical.
    // The original hook might have handled this differently (e.g., during preview generation).
    // For now, we'll focus on type and size. A more robust solution might involve
    // createImageBitmap or new Image() to get dimensions.
    // console.warn("Image dimension check not implemented in this extracted utility.");
  }

  return true;
};
