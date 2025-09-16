import { LanguageModel } from "ai";
import { Router, Request, Response } from "express";

// model providers
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import { xai } from "@ai-sdk/xai";
import { togetherai } from "@ai-sdk/togetherai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { mistral } from "@ai-sdk/mistral";
import { wrapLanguageModel, extractReasoningMiddleware } from "ai";
import { Mistral as MistralAi } from "@mistralai/mistralai";
import { MARKITDOWN_MIME_TYPES } from "../config/constants";

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

const perplexity = createPerplexity({
  apiKey: process.env.PPLX_API_KEY ?? "",
});

export const mistralAi = new MistralAi({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});

export interface ModelConfig {
  model: LanguageModel;
  supportsToolUse: boolean;
  supportsStreaming: boolean;
  provider: string;
  supportsSystemMessages?: boolean;
  supportedMimeTypes?: string[];
  maxFileSize?: number;
  maxImageSize?: number;
  description: string;
}

export const anthropicModels = (
  apiKey?: string
): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  const supportedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    ...MARKITDOWN_MIME_TYPES,
  ];

  return {
    "claude-4-sonnet": {
      model: anthropic("claude-sonnet-4-20250514"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Claude Sonnet 4 significantly improves on Sonnet 3.7's industry-leading capabilities, excelling in coding with a state-of-the-art 72.7% on SWE-bench. The model balances performance and efficiency for internal and external use cases, with enhanced steerability for greater control over implementations. While not matching Opus 4 in most domains, it delivers an optimal mix of capability and practicality.",
    },
  };
};

export const openaiModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  const supportedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    ...MARKITDOWN_MIME_TYPES,
  ];

  return {
    "gpt-5": {
      model: openai.responses("gpt-5"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      provider: "openai",
      supportedMimeTypes,
      description:
        "GPT-5 is OpenAI's flagship language model that excels at complex reasoning, broad real-world knowledge, code-intensive, and multi-step agentic tasks.",
    },
    "gpt-5-mini": {
      model: openai.responses("gpt-5-mini"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      provider: "openai",
      supportedMimeTypes,
      description:
        "GPT-5 mini is a cost optimized model that excels at reasoning/chat tasks. It offers an optimal balance between speed, cost, and capability.",
    },
  };
};

export const googleModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  const supportedMimeTypes = [
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
    ...MARKITDOWN_MIME_TYPES,
  ];

  return {
    "gemini-2.5-pro": {
      model: google("gemini-2.5-pro"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 2 * 1024 * 1024 * 1024, // 2GB
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Gemini 2.5 Pro Experimental is Google's state-of-the-art thinking model, capable of reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context.",
    },
    "gemini-2.5-flash": {
      model: google("gemini-2.5-flash"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 2 * 1024 * 1024 * 1024,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Gemini 2.5 Flash is Google's first fully hybrid reasoning model, giving developers the ability to turn thinking on or off. The model also allows developers to set thinking budgets to find the right tradeoff between quality, cost, and latency.",
    },
  };
};

export const xAiModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  const supportedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    ...MARKITDOWN_MIME_TYPES,
  ];

  return {
    "grok-4": {
      model: xai("grok-4"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "xai",
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      maxImageSize: 10 * 1024 * 1024, // 10MB
      supportedMimeTypes,
      description:
        "xAI's latest and greatest flagship model, offering unparalleled performance in natural language, math and reasoning - the perfect jack of all trades.",
    },
  };
};

export const togetherAiModels = (
  apiKey?: string
): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  const supportedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    ...MARKITDOWN_MIME_TYPES,
  ];

  return {
    "deepseek-r1": {
      model: wrapLanguageModel({
        model: togetherai("deepseek-ai/DeepSeek-R1"),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      }),
      supportedMimeTypes,
      supportsToolUse: false,
      supportsStreaming: true,
      provider: "deepseek",
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "DeepSeek Reasoner is a specialized model developed by DeepSeek that uses Chain of Thought (CoT) reasoning to improve response accuracy. Before providing a final answer, it generates detailed reasoning steps that are accessible through the API, allowing users to examine and leverage the model's thought process. The model is hosted on Together AI and running on USA servers, no data gets shared with DeepSeek or china.",
    },
    "deepseek-v3": {
      model: togetherai("deepseek-ai/DeepSeek-V3"),
      supportsToolUse: false,
      supportsStreaming: true,
      supportedMimeTypes,
      provider: "deepseek",
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description: `DeepSeek-V3 is an open-source large language model that builds upon LLaMA (Meta’s foundational language model) to enable versatile functionalities such as text generation, code completion, and more. The model is hosted on Together AI and running on USA servers, no data gets shared with DeepSeek or china.`,
    },
    "llama-4-maverick": {
      model: togetherai("meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8"),
      supportsToolUse: false,
      supportsStreaming: true,
      supportedMimeTypes,
      provider: "meta",
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Llama 4 Maverick is a large language model that is optimized for reasoning and has a focus on providing accurate and helpful responses. It is hosted on Together AI and running on USA servers, no data gets shared with Meta.",
    },
    "llama-4-scout": {
      model: togetherai("meta-llama/Llama-4-Scout-17B-16E-Instruct"),
      supportsToolUse: false,
      supportsStreaming: true,
      supportedMimeTypes,
      provider: "meta",
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Llama 4 Scout is a large language model that is optimized for reasoning and has a focus on providing accurate and helpful responses. It is hosted on Together AI and running on USA servers, no data gets shared with Meta.",
    },
    "llama-3.3-70b": {
      model: togetherai("meta-llama/Llama-3.3-70B-Instruct-Turbo"),
      supportsToolUse: false,
      supportsStreaming: true,
      supportedMimeTypes,
      provider: "meta",
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "The Meta Llama 3.1 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 405B (text in/text out). The Llama 3.1 instruction tuned text only model is optimized for multilingual dialogue use cases and outperforms many of the available open source and closed chat models on common industry benchmarks.",
    },
  };
};

export const groqModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  return {
    "llama-3.3-70b": {
      model: groq("llama-3.3-70b-versatile"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      supportedMimeTypes: [...MARKITDOWN_MIME_TYPES],
      provider: "meta",
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out). The Llama 3.3 instruction tuned text only model is optimized for multilingual dialogue use cases and outperforms many of the available open source and closed chat models on common industry benchmarks.",
    },
  };
};

export const perplexityModels = (
  apiKey?: string
): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  return {
    "sonar-reasoning": {
      model: wrapLanguageModel({
        model: perplexity("sonar-reasoning"),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      }),
      supportsToolUse: false,
      supportsStreaming: true,
      provider: "perplexity",
      supportedMimeTypes: [],
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description: "New API offering powered by DeepSeek's reasoning models",
    },
    "sonar-pro": {
      model: perplexity("sonar-pro"),
      supportsToolUse: false,
      supportsStreaming: true,
      supportedMimeTypes: [],
      provider: "perplexity",
      supportsSystemMessages: true,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Permier offering with search grounding, supporting advanced queries and follow-ups",
    },
    sonar: {
      model: perplexity("sonar"),
      supportsToolUse: false,
      supportsStreaming: true,
      provider: "perplexity",
      supportsSystemMessages: true,
      supportedMimeTypes: [],
      description:
        "Perplexity's lightweight offering with search grounding, quicker and cheaper than Sonar Pro.",
    },
  };
};

export const mistralModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  const supportedMimeTypes: string[] = [];

  return {
    "mistral-large": {
      model: mistral("mistral-large-latest"),
      supportsToolUse: false,
      supportsStreaming: true,
      provider: "mistral",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Mistral Large is a large language model optimized for performance and accuracy. It is suitable for a wide range of tasks that require high-quality responses.",
    },
    "mistral-small": {
      model: mistral("mistral-small-latest"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "mistral",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxFileSize: MAX_FILE_SIZE, // 1GB
      description:
        "Mistral Small is a smaller version of the Mistral language model that is optimized for speed and efficiency. It is suitable for tasks that require quick responses and low resource usage.",
    },
  };
};

export const MODELS: Record<string, ModelConfig> = {
  ...anthropicModels(process.env.ANTHROPIC_API_KEY),
  ...openaiModels(process.env.OPENAI_API_KEY),
  ...googleModels(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  ...xAiModels(process.env.XAI_API_KEY),
  ...mistralModels(process.env.MISTRAL_API_KEY),
  //   ...togetherAiModels(process.env.TOGETHER_AI_API_KEY),
  //   ...groqModels(process.env.GROQ_API_KEY),
  //   ...perplexityModels(process.env.PPLX_API_KEY),
};

export const embeddingModel = openai.embedding("text-embedding-3-large", {
  dimensions: 1536,
});

export const smallOpenaiEmbeddingModel = openai.textEmbeddingModel(
  "text-embedding-3-large",
  {
    dimensions: 768,
  }
);

export const googleEmbeddingModel = google.textEmbeddingModel(
  "text-embedding-004",
  {
    outputDimensionality: 768,
  }
);

const ops = {
  listModels: () => {
    return Object.entries(MODELS).map(([modelName, config]) => ({
      name: modelName,
      supportsToolUse: config.supportsToolUse,
      supportsStreaming: config.supportsStreaming,
      provider: config.provider,
      supportedMimeTypes: config.supportedMimeTypes,
      maxImageSize: config.maxImageSize,
      maxFileSize: config.maxFileSize,
      description: config.description,
    }));
  },
};

const handlers = {
  getModels: async (req: Request, res: Response) => {
    res.json(ops.listModels());
  },
};

export default Router().get("", handlers.getModels);
