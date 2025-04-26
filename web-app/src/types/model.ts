export interface Model {
  name: string;
  provider: string;
  supportsToolUse?: boolean;
  supportsStreaming?: boolean;
  description?: string;
  maxFileSize?: number;
  maxImageSize?: number;
  supportedMimeTypes?: string[];
}
