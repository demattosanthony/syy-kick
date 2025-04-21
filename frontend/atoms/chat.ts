import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Model } from "@/types/model";
import { Artifact, ChatMessage, FileUpload } from "@/types/chat";
import { DocumentContent } from "@/types/project";
import { WorkflowAttachment } from "@/features/workflows/components/workflow-page-content";

export const CLAUDE_3_5_CONFIG = {
  name: "claude-3.7-sonnet",
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
    "text/x-python",
    "text/x-script.python",
    "application/x-python-code",
    "text/plain",
    "text/html",
    "text/md",
    "text/csv",
    "text/xml",
    "text/rtf",
    "text/markdown",
    "text/x-markdown",
    "text/org",
    "text/asciidoc",
    "text/restructuredtext",
    "text/textile",
    "text/wiki",
    "text/yaml",
    "text/toml",
    "text/ini",
    "text/properties",
    "text/conf",
    "text/log",
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
  "selectedAiModel-v2.2",
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
export const selectedArtifactAtom = atom<Artifact | null>(null);
export const alreadyAutoSelectedArtifactAtom = atom<string | null>(null);
export const workflowInputAtom = atom<{
  attachments: WorkflowAttachment[];
  input: string;
}>({
  attachments: [],
  input: "",
});
