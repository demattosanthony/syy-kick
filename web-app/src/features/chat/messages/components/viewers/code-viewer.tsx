import React from "react";
import { CodeBlock, CodeBlockCode } from "./code-block";

// Function to extract language from various mimeType formats
const getLanguageFromMimeType = (mimeType: string): string => {
  if (!mimeType) return "";

  const lowerMime = mimeType.toLowerCase();

  // Handle common patterns
  const mimeToLanguage: Record<string, string> = {
    "text/x-python": "python",
    "application/x-python": "python",
    "text/x-java": "java",
    "text/x-c++src": "cpp",
    "text/x-csrc": "c",
    "text/x-csharp": "csharp",
    "text/javascript": "javascript",
    "application/javascript": "javascript",
    "text/x-javascript": "javascript",
    "application/json": "json",
    "text/x-go": "go",
    "text/x-rust": "rust",
    "text/x-ruby": "ruby",
    "text/x-php": "php",
    "text/x-swift": "swift",
    "text/x-kotlin": "kotlin",
    "text/x-scala": "scala",
    "text/x-typescript": "typescript",
    "application/typescript": "typescript",
    "text/x-sh": "bash",
    "text/x-bash": "bash",
    "application/x-sh": "bash",
    "text/x-powershell": "powershell",
    "text/x-sql": "sql",
    "application/sql": "sql",
    "text/css": "css",
    "text/html": "html",
    "application/xml": "xml",
    "text/xml": "xml",
    "text/yaml": "yaml",
    "application/yaml": "yaml",
    "text/x-yaml": "yaml",
  };

  // Direct mapping
  if (mimeToLanguage[lowerMime]) {
    return mimeToLanguage[lowerMime];
  }

  // Handle x-prefixed types (e.g., "x-python")
  if (lowerMime.startsWith("x-")) {
    const lang = lowerMime.substring(2);
    return lang;
  }

  // Handle text/x-* pattern
  if (lowerMime.startsWith("text/x-")) {
    const lang = lowerMime.substring(7);
    return lang;
  }

  // Handle application/x-* pattern
  if (lowerMime.startsWith("application/x-")) {
    const lang = lowerMime.substring(14);
    return lang;
  }

  // Handle standard text/* pattern
  if (lowerMime.startsWith("text/")) {
    const lang = lowerMime.substring(5);
    return lang;
  }

  // Handle application/* pattern
  if (lowerMime.startsWith("application/")) {
    const lang = lowerMime.substring(12);
    return lang;
  }

  // Fallback: split by "/" and take the last part
  const parts = lowerMime.split("/");
  return parts[parts.length - 1] || "";
};

export const CodeViewer: React.FC<{ content: string; mimeType: string }> = ({
  content,
  mimeType,
}) => {
  // Get language from mimeType
  const language = getLanguageFromMimeType(mimeType);

  return (
    <div className="w-full max-w-full">
      <CodeBlock className="border-none">
        <CodeBlockCode code={content} language={language} />
      </CodeBlock>
    </div>
  );
};
