import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Model } from "@/types/model";
import { Artifact, ChatMessage, FileUpload } from "@/types/chat";
import { DocumentContent } from "@/types/project";

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
    // Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",

    // Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "application/zip",

    // Basic text types
    "text/plain",
    "text/html",
    "text/css",
    "text/csv",
    "text/xml",
    "text/rtf",
    "application/json",

    // Markdown and documentation
    "text/markdown",
    "text/x-markdown",
    "text/md",
    "text/org",
    "text/asciidoc",
    "text/restructuredtext",
    "text/textile",
    "text/wiki",
    "text/x-tex",
    "text/x-bibtex",
    "text/x-readme",

    // Configuration files
    "text/yaml",
    "text/x-yaml",
    "application/x-yaml",
    "text/toml",
    "text/ini",
    "text/properties",
    "text/conf",
    "text/x-config",
    "text/x-env",
    "text/x-gitignore",
    "text/x-editorconfig",

    // JavaScript ecosystem
    "application/javascript",
    "application/x-javascript",
    "text/javascript",
    "text/x-javascript",
    "application/typescript",
    "text/typescript",
    "text/x-typescript",
    "text/jsx",
    "text/x-jsx",
    "text/tsx",
    "text/x-tsx",
    "text/x-vue",
    "application/node",

    // Python
    "application/x-python",
    "text/python",
    "text/x-python",
    "text/x-python-script",
    "text/x-script.python",
    "application/x-python-code",

    // Java ecosystem
    "text/x-java-source",
    "text/x-java",
    "text/x-kotlin",
    "text/x-scala",

    // C/C++
    "text/x-c",
    "text/x-c++",
    "text/x-cpp",
    "text/x-chdr",
    "text/x-csrc",

    // C# and .NET
    "text/x-csharp",
    "text/x-fsharp",

    // Other compiled languages
    "text/x-go",
    "text/x-rust",
    "text/x-swift",

    // Web languages
    "text/x-php",
    "application/x-httpd-php",
    "text/x-ruby",
    "text/x-scss",
    "text/x-sass",
    "text/x-less",

    // Functional languages
    "text/x-haskell",
    "text/x-ocaml",
    "text/x-erlang",
    "text/x-elixir",
    "text/x-clojure",
    "text/x-lisp",
    "text/x-scheme",

    // Data science and analytics
    "text/x-r",
    "text/x-matlab",
    "text/x-octave",
    "text/x-julia",

    // Scripting languages
    "text/x-perl",
    "text/x-lua",
    "text/x-tcl",
    "text/x-awk",

    // Shell and system
    "text/x-shellscript",
    "application/x-sh",
    "text/x-bash",
    "text/x-zsh",
    "text/x-fish",
    "text/x-powershell",
    "text/x-batch",
    "application/x-bat",
    "text/x-dockerfile",
    "text/x-makefile",

    // Database
    "text/x-sql",
    "application/sql",
    "text/x-mysql",
    "text/x-postgresql",

    // Hardware description
    "text/x-vhdl",
    "text/x-verilog",
    "text/x-systemverilog",

    // Assembly and low-level
    "text/x-asm",
    "text/x-nasm",

    // Logs and diffs
    "text/log",
    "text/x-log",
    "text/x-diff",
    "text/x-patch",

    // Misc formats
    "text/x-json",
    "application/x-ndjson",
    "text/x-jsonc",
    "text/x-graphql",
    "text/x-proto",
    "text/x-thrift",
  ],
  maxImageSize: 2 * 1024 * 1024 * 1024, // 2GB
  maxFileSize: 1024 * 1024 * 1024, // 1GB
};

export const SONAR_PRO_CONFIG = {
  name: "sonar-pro",
  provider: "perplexity",
};

// Persistent atoms
export const modelAtom = atomWithStorage<Model>(
  "selectedAiModel-v4",
  AUTO_MODEL_CONFIG
);
export const temperatureAtom = atomWithStorage("chatTemp", 0.5);
export const instructionsAtom = atomWithStorage("customInstructions", "");

// Session atoms
export const messagesAtom = atom<ChatMessage[]>([]);
export const chatStatusAtom = atom<
  "ready" | "submitted" | "streaming" | "error"
>("ready");
export const initalInputAtom = atom("");
export const inputAtom = atom("");
export const uploadsAtom = atom<FileUpload[]>([]);
export const abortControllerAtom = atom<AbortController>(new AbortController());
export const selectedProjectDocsAtom = atom<DocumentContent[]>([]);
export const selectedArtifactAtom = atom<Artifact | null>(null);
export const alreadyAutoSelectedArtifactAtom = atom<string | null>(null);
export const userClosedArtifactsAtom = atom<Set<string>>(new Set<string>());
export const artifactSelectionModeAtom = atom<"auto" | "manual">("auto");

// Pending thread creation atoms
export interface PendingThread {
  tempId: string;
  initialMessage: string;
  uploads: FileUpload[];
  model: string;
  instructions?: string;
  status: "uploading" | "created" | "error";
  actualThreadId?: string;
  error?: string;
}

export const pendingThreadAtom = atom<PendingThread | null>(null);
export const isPendingThreadAtom = atom<boolean>(false);
