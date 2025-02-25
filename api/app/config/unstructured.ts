import { UnstructuredClient } from "unstructured-client";

const unstructured = new UnstructuredClient({
  serverURL: process.env.UNSTRUCTURED_API_URL,
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY,
  },
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: 3000, // 3 seconds
      maxInterval: 1000 * 60 * 12, // 12 minutes
      exponent: 1.88, // ~2 hours
      maxElapsedTime: 1000 * 60 * 60, // 1 hour
    },
    retryConnectionErrors: true,
  },
});

// Define supported extensions:
export const ALLOWED_UNSTRUCTURED_EXTENSIONS = [
  ".abw",
  ".bmp",
  ".csv",
  ".cwk",
  ".dbf",
  ".dif",
  ".doc",
  ".docm",
  ".docx",
  ".dot",
  ".dotm",
  ".eml",
  ".epub",
  ".et",
  ".eth",
  ".fods",
  ".gif",
  ".heic",
  ".htm",
  ".html",
  ".hwp",
  ".jpeg",
  ".jpg",
  ".md",
  ".mcw",
  ".mw",
  ".odt",
  ".org",
  ".p7s",
  ".pages",
  ".pbd",
  ".pdf",
  ".png",
  ".pot",
  ".potm",
  ".ppt",
  ".pptm",
  ".pptx",
  ".prn",
  ".rst",
  ".rtf",
  ".sdp",
  ".sgl",
  ".svg",
  ".sxg",
  ".tiff",
  ".txt",
  ".tsv",
  ".uof",
  ".uos1",
  ".uos2",
  ".web",
  ".webp",
  ".wk2",
  ".xls",
  ".xlsb",
  ".xlsm",
  ".xlsx",
  ".xlw",
  ".xml",
  ".zabw",
];

export default unstructured;
