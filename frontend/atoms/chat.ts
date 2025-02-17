import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Model } from "@/types/model";
import { ChatMessage, FileUpload } from "@/types/chat";
import { DocumentContent } from "@/types/project";

export const CLAUDE_3_5_CONFIG = {
  name: "claude-3.5-sonnet",
  provider: "anthropic",
  supportedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ],
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxFileSize: 32 * 1024 * 1024, // 32MB
};

export const AUTO_MODEL_CONFIG = {
  name: "Auto",
  provider: "Auto",
  supportedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "application/pdf",
    "application/x-javascript",
    "text/javascript",
    "application/x-python",
    "text/python",
    "text/plain",
    "text/html",
    "text/md",
    "text/csv",
    "text/xml",
    "text/rtf",
  ],
  maxImageSize: 2 * 1024 * 1024 * 1024, // 2GB
  maxFileSize: 50 * 1024 * 1024, // 50MB
};

export const SONAR_PRO_CONFIG = {
  name: "sonar-pro",
  provider: "perplexity",
};

// Persistent atoms
export const modelAtom = atomWithStorage<Model>(
  "selectedAiModel",
  AUTO_MODEL_CONFIG
);
export const temperatureAtom = atomWithStorage("chatTemp", 0.5);
export const instructionsAtom = atomWithStorage("customInstructions", "");

// Session atoms
export const messagesAtom = atom<ChatMessage[]>([]);
export const isGeneratingAtom = atom(false);
export const initalInputAtom = atom("");
export const inputAtom = atom("");
export const uploadsAtom = atom<FileUpload[]>([]);
export const abortControllerAtom = atom<AbortController>(new AbortController());
export const selectedProjectDocsAtom = atom<DocumentContent[]>([]);
