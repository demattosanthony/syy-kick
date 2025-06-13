import { Workspace } from "./middleware";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export function getOrgIdOrUnedfined(workspace?: Workspace) {
  return workspace?.type === "organization" ? workspace.id : undefined;
}

export const slugify = (text: string) => {
  return text
    .toString() // Cast to string
    .toLowerCase() // Convert the string to lowercase letters
    .normalize("NFD") // The normalize() method returns the Unicode Normalization Form of a given string.
    .trim() // Remove whitespace from both sides of a string
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
};

export const generateFileSlug = (fileName: string) => {
  const ext = path.extname(fileName);
  const baseName = slugify(path.basename(fileName, ext));
  return `${baseName}-${uuidv4().split("-")[0]}${ext}`;
};

export function getFileHash(fileBuffer: Buffer): string {
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}
