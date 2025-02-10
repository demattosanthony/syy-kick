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
import { wrapLanguageModel, extractReasoningMiddleware } from "ai";

const perplexity = createPerplexity({
  apiKey: process.env.PPLX_API_KEY ?? "",
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

  return {
    "claude-3.5-sonnet": {
      model: anthropic("claude-3-5-sonnet-20241022"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
      ],
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxFileSize: 32 * 1024 * 1024, // 32MB
      description:
        "Claude 3.5 Sonnet strikes the ideal balance between intelligence and speed—particularly for enterprise workloads. It delivers strong performance at a lower cost compared to its peers, and is engineered for high endurance in large-scale AI deployments.",
    },
    "claude-3.5-haiku": {
      model: anthropic("claude-3-5-haiku-latest"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "anthropic",
      supportsSystemMessages: true,
      supportedMimeTypes: [
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

  return {
    o1: {
      model: openai("o1"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      provider: "openai",
      supportedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ],
      description:
        "o1 is a versatile model from OpenAI, capable of handling a wide range of tasks with good performance. It supports tool use, streaming, system messages, and image inputs, making it a solid all-around choice.",
    },
    "o3-mini": {
      model: openai("o3-mini"),
      supportsToolUse: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      provider: "openai",
      maxImageSize: 20 * 1024 * 1024, // 20MB
      //   supportedMimeTypes: [
      //     "image/jpeg",
      //     "image/png",
      //     "image/webp",
      //     "image/gif",
      //   ],
      description:
        "o3-mini is a smaller, more efficient version of o3, designed for faster responses and lower resource usage. It's suitable for tasks where speed and cost-effectiveness are priorities, while still offering good performance and supporting tool use, streaming, system messages, and image inputs.",
    },
    "gpt-4o": {
      model: openai("gpt-4o"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "openai",
      supportsSystemMessages: true,
      maxImageSize: 20 * 1024 * 1024, // 20MB
      supportedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ],
      description:
        "GPT-4o from OpenAI has broad general knowledge and domain expertise allowing it to follow complex instructions in natural language and solve difficult problems accurately. It matches GPT-4 Turbo performance with a faster and cheaper API.",
    },
    "gpt-4o-mini": {
      model: openai("gpt-4o-mini"),
      supportsToolUse: true,
      provider: "openai",
      supportsStreaming: true,
      supportsSystemMessages: true,
      maxImageSize: 20 * 1024 * 1024, // 20MB
      supportedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ],
      description:
        "GPT-4o mini from OpenAI is their most advanced and cost-efficient small model. It is multi-modal (accepting text or image inputs and outputting text) and has higher intelligence than gpt-3.5-turbo but is just as fast.",
    },
  };
};

export const googleModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  return {
    "gemini-2.0-pro": {
      model: google("gemini-2.0-pro-exp-02-05"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
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
      description:
        "Gemini 2.0 Pro is a robust model from Google, well-suited for a variety of tasks including text generation, translation, and code completion. It supports tool use, streaming, image and PDF inputs, making it a versatile option for many applications.",
    },
    "gemini-2.0-flash": {
      model: google("gemini-2.0-flash"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
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
      maxImageSize: 2 * 1024 * 1024 * 1024, //
      maxFileSize: 50 * 1024 * 1024, // 50MB
      description:
        "Gemini 2.0 Flash delivers next-gen features and improved capabilities, including superior speed, native tool use, multimodal generation, and a 1M token context window.",
    },
    "gemini-2.0-flash-online": {
      model: google("gemini-2.0-flash", {
        useSearchGrounding: true,
      }),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
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
      description:
        "Gemini 2.0 Flash Online enhances the speed of Gemini 2.0 Flash with the ability to access real-time information through search grounding. It's perfect for tasks that require up-to-date data and fast responses, while also supporting tool use, streaming, image and PDF inputs.",
    },
    "gemini-2.0-flash-thinking": {
      model: google("gemini-2.0-flash-thinking-exp-01-21"),
      supportsToolUse: false,
      supportsStreaming: true,
      provider: "google",
      supportsSystemMessages: true,
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
      description:
        "Gemini 2.0 Flash Thinking is an experimental model trained to expose its reasoning process in responses. By making its thinking process explicit, this model demonstrates enhanced reasoning capabilities compared to other Gemini 2.0 Flash models.",
    },
  };
};

export const xAiModels = (apiKey?: string): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  return {
    "grok-2": {
      model: xai("grok-2-1212"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "xai",
      supportsSystemMessages: true,
      description:
        "Grok is an AI modeled after the Hitchhiker’s Guide to the Galaxy. It is intended to answer almost anything and, far harder, even suggest what questions to ask!",
    },
    "grok-2-vision": {
      model: xai("grok-2-vision-1212"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "xai",
      supportsSystemMessages: true,
      supportedMimeTypes: ["image/jpeg", "image/png"],
      maxImageSize: 10 * 1024 * 1024, // 10MB
      description:
        "In addition to Grok's strong text capabilities, this multimodal model can now process a wide variety of visual information, including documents, diagrams, charts, screenshots, and photographs.",
    },
  };
};

export const togetherAiModels = (
  apiKey?: string
): Record<string, ModelConfig> => {
  if (!apiKey) return {};

  return {
    "deepseek-r1": {
      model: wrapLanguageModel({
        model: togetherai("deepseek-ai/DeepSeek-R1"),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      }),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "deepseek",
      supportsSystemMessages: true,
      description:
        "DeepSeek Reasoner is a specialized model developed by DeepSeek that uses Chain of Thought (CoT) reasoning to improve response accuracy. Before providing a final answer, it generates detailed reasoning steps that are accessible through the API, allowing users to examine and leverage the model's thought process. The model is hosted on Together AI and running on USA servers, no data gets shared with DeepSeek or china.",
    },
    "deepseek-v3": {
      model: togetherai("deepseek-ai/DeepSeek-V3"),
      supportsToolUse: true,
      supportsStreaming: true,
      provider: "deepseek",
      supportsSystemMessages: true,
      description: `DeepSeek-V3 is an open-source large language model that builds upon LLaMA (Meta’s foundational language model) to enable versatile functionalities such as text generation, code completion, and more. The model is hosted on Together AI and running on USA servers, no data gets shared with DeepSeek or china.`,
    },
    "llama-3.1-405B": {
      model: togetherai("meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"),
      supportsToolUse: true,
      supportsStreaming: true,
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
      model: wrapLanguageModel({
        model: groq("deepseek-r1-distill-llama-70b"),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      }),
      supportsToolUse: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
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
      supportsSystemMessages: true,
      description: "New API offering powered by DeepSeek's reasoning models",
    },
    "sonar-pro": {
      model: perplexity("sonar-pro"),
      supportsToolUse: false,
      supportsStreaming: true,
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
      description:
        "Perplexity's lightweight offering with search grounding, quicker and cheaper than Sonar Pro.",
    },
  };
};

export const MODELS: Record<string, ModelConfig> = {
  ...anthropicModels(process.env.ANTHROPIC_API_KEY),
  ...openaiModels(process.env.OPENAI_API_KEY),
  ...googleModels(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  ...xAiModels(process.env.XAI_API_KEY),
  ...togetherAiModels(process.env.TOGETHER_AI_API_KEY),
  ...groqModels(process.env.GROQ_API_KEY),
  ...perplexityModels(process.env.PPLX_API_KEY),
};

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
