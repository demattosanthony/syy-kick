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
    "claude-4-opus": {
      model: anthropic("claude-4-opus-20250514"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxFileSize: 32 * 1024 * 1024, // 32MB
      description:
        "Claude Opus 4 is Anthropic's most powerful model yet and the best coding model in the world, leading on SWE-bench (72.5%) and Terminal-bench (43.2%). It delivers sustained performance on long-running tasks that require focused effort and thousands of steps, with the ability to work continuously for several hours—dramatically outperforming all Sonnet models and significantly expanding what AI agents can accomplish.",
    },
    "claude-4-sonnet": {
      model: anthropic("claude-4-sonnet-20250514"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxFileSize: 32 * 1024 * 1024, // 32MB
      description:
        "Claude Sonnet 4 significantly improves on Sonnet 3.7's industry-leading capabilities, excelling in coding with a state-of-the-art 72.7% on SWE-bench. The model balances performance and efficiency for internal and external use cases, with enhanced steerability for greater control over implementations. While not matching Opus 4 in most domains, it delivers an optimal mix of capability and practicality.",
    },
    "claude-3.7-sonnet": {
      model: anthropic("claude-3-7-sonnet-20250219"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxFileSize: 32 * 1024 * 1024, // 32MB
      description:
        "Claude 3.7 Sonnet is a hybrid model capable of both standard thinking as well as extended thinking modes. In standard mode, Claude 3.7 Sonnet operates similarly to other models in the Claude 3 family. In extended thinking mode, Claude will output its thinking before outputting its response, allowing you insight into its reasoning process.",
    },
    "claude-3.5-sonnet": {
      model: anthropic("claude-3-5-sonnet-latest"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      description:
        "Claude 3.5 Haiku is the next generation of our fastest model. For a similar speed to Claude 3 Haiku, Claude 3.5 Haiku improves across every skill set and surpasses Claude 3 Opus, the largest model in our previous generation, on many intelligence benchmarks.",
    },
    "claude-3.5-haiku": {
      model: anthropic("claude-3-5-haiku-latest"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes: [
        ...MARKITDOWN_MIME_TYPES,
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ],
      maxImageSize: 5 * 1024 * 1024, // 5MB
      description:
        "Claude 3.5 Haiku is the next generation of our fastest model. For a similar speed to Claude 3 Haiku, Claude 3.5 Haiku improves across every skill set and surpasses Claude 3 Opus, the largest model in our previous generation, on many intelligence benchmarks.",
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
    "o4-mini": {
      model: openai.responses("o4-mini-2025-04-16"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      provider: "openai",
      supportedMimeTypes,
      description:
        "OpenAI's o4-mini delivers fast, cost-efficient reasoning with exceptional performance for its size, particularly excelling in math (best-performing on AIME benchmarks), coding, and visual tasks.",
    },
    o3: {
      model: openai.responses("o3-2025-04-16"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      provider: "openai",
      supportedMimeTypes,
      description:
        "OpenAI's o3 is their most powerful reasoning model, setting new state-of-the-art benchmarks in coding, math, science, and visual perception. It excels at complex queries requiring multi-faceted analysis, with particular strength in analyzing images, charts, and graphics.",
    },
    "o3-mini": {
      model: openai.responses("o3-mini"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      supportedMimeTypes,
      provider: "openai",
      maxImageSize: 20 * 1024 * 1024, // 20MB
      description:
        "o3-mini is OpenAI's most recent small reasoning model, providing high intelligence at the same cost and latency targets of o1-mini.",
    },
    "gpt-4o": {
      model: openai.responses("gpt-4o"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "openai",
      supportsSystemMessages: true,
      maxImageSize: 20 * 1024 * 1024, // 20MB
      supportedMimeTypes,
      description:
        "GPT 4o is OpenAI's flagship model for complex tasks. It is well suited for problem solving across domains.",
    },
    "gpt-4.1": {
      model: openai.responses("gpt-4.1"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "openai",
      supportsSystemMessages: true,
      maxImageSize: 20 * 1024 * 1024, // 20MB
      supportedMimeTypes,
      description:
        "GPT 4.1 is OpenAI's flagship model for complex tasks. It is well suited for problem solving across domains.",
    },
    "gpt-4.1-mini": {
      model: openai.responses("gpt-4.1-mini"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "openai",
      supportsSystemMessages: true,
      maxImageSize: 20 * 1024 * 1024, // 20MB
      supportedMimeTypes,
      description:
        "GPT 4.1 mini provides a balance between intelligence, speed, and cost that makes it an attractive model for many use cases.",
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
    "gemini-2.5-pro-preview": {
      model: google("gemini-2.5-pro-preview-06-05"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 2 * 1024 * 1024 * 1024,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      description:
        "Gemini 2.5 Pro Experimental is Google's state-of-the-art thinking model, capable of reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context.",
    },
    "gemini-2.5-flash-preview": {
      model: google("gemini-2.5-flash-preview-04-17"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 2 * 1024 * 1024 * 1024,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      description:
        "Gemini 2.5 Flash is Google's first fully hybrid reasoning model, giving developers the ability to turn thinking on or off. The model also allows developers to set thinking budgets to find the right tradeoff between quality, cost, and latency.",
    },
    "gemini-2.5-flash-online": {
      model: google("gemini-2.5-flash-preview-04-17", {
        useSearchGrounding: true,
      }),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
      supportedMimeTypes,
      maxImageSize: 2 * 1024 * 1024 * 1024, //
      maxFileSize: 50 * 1024 * 1024, // 50MB
      description:
        "Gemini 2.5 Flash is Google's first fully hybrid reasoning model, giving developers the ability to turn thinking on or off. The model also allows developers to set thinking budgets to find the right tradeoff between quality, cost, and latency.",
    },
  };
};

export const xAiModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  return {
    "grok-3-beta": {
      model: xai("grok-3-beta"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "xai",
      supportsSystemMessages: true,
      supportedMimeTypes: [...MARKITDOWN_MIME_TYPES],
      description:
        "xAI's flagship model that excels at enterprise use cases like data extraction, coding, and text summarization. Possesses deep domain knowledge in finance, healthcare, law, and science.",
    },
    "grok-3-mini-beta": {
      model: xai("grok-3-mini-beta"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "xai",
      supportsSystemMessages: true,
      supportedMimeTypes: [...MARKITDOWN_MIME_TYPES],
      maxImageSize: 10 * 1024 * 1024, // 10MB
      description:
        "xAI's lightweight model that thinks before responding. Great for simple or logic-based tasks that do not require deep domain knowledge. The raw thinking traces are accessible.",
    },
  };
};

export const togetherAiModels = (
  apiKey?: string
): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  const supportedMimeTypes = [...MARKITDOWN_MIME_TYPES];

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
      description: `DeepSeek-V3 is an open-source large language model that builds upon LLaMA (Meta’s foundational language model) to enable versatile functionalities such as text generation, code completion, and more. The model is hosted on Together AI and running on USA servers, no data gets shared with DeepSeek or china.`,
    },
    "llama-4-maverick": {
      model: togetherai("meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8"),
      supportsToolUse: false,
      supportsStreaming: true,
      supportedMimeTypes,
      provider: "meta",
      supportsSystemMessages: true,
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
      description: "New API offering powered by DeepSeek's reasoning models",
    },
    "sonar-pro": {
      model: perplexity("sonar-pro"),
      supportsToolUse: false,
      supportsStreaming: true,
      supportedMimeTypes: [],
      provider: "perplexity",
      supportsSystemMessages: true,
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
  ...togetherAiModels(process.env.TOGETHER_AI_API_KEY),
  //   ...groqModels(process.env.GROQ_API_KEY),
  ...perplexityModels(process.env.PPLX_API_KEY),
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
