export const CONFIG = {
  PORT: process.env.PORT || 4000,
  CORS_ORIGINS: [
    process.env.FRONTEND_URL!,
    "https://syykick.com",
    "https://www.syykick.com",
    "https://yo.syyclops.com",
    "https://www.yo.syyclops.com",
    "https://yo-syyclops.vercel.app",
  ],
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    domain: process.env.NODE_ENV === "production" ? ".syykick.com" : "",
    path: "/",
  },
  EMAIL_WHITELIST: [
    "mgkurass@gmail.com",
    "gopal24krishna@gmail.com",
    "ben.montalbano12@gmail.com",
    "adi.mechie@gmail.com",
    "quentinnippert@gmail.com",
  ],
  __prod__: process.env.NODE_ENV === "production",
};

export const ACCEPTED_DOC_PROCESSING_MIME_TYPES = [
  // Word documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc

  // Excel spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls

  // PowerPoint presentations
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-powerpoint", // .ppt

  // Text formats
  "text/html", // .html
  "text/csv", // .csv
  "application/json", // .json
  "application/xml", // .xml
  "text/xml", // .xml
  "text/markdown", // .md
  "text/plain", // .txt
  "text/rtf", // .rtf
  "application/rtf", // .rtf

  // Archive
  "application/zip", // .zip

  // Audio
  "audio/mpeg", // .mp3
  "audio/wav", // .wav
  "audio/ogg", // .ogg
  "audio/aac", // .aac
  "audio/midi", // .mid, .midi
  "audio/x-midi", // .mid, .midi

  // Video
  "video/mp4", // .mp4
  "video/x-msvideo", // .avi
  "video/quicktime", // .mov
  "video/x-ms-wmv", // .wmv
  "video/x-flv", // .flv
  "video/mpeg", // .mpeg, .mpg
];

export const ACCEPTED_DOC_PROCESSING_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".xls",
  ".xlsx",
  ".pptx",
  ".ppt",
  ".html",
  ".csv",
  ".json",
  ".xml",
  ".zip",
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".mid",
  ".midi",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".mpeg",
  ".mpg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".tiff",
  ".ico",
  ".heic",
  ".md",
  ".txt",
  ".rtf",
];
