/**
 * Get your Jina AI API key for free: https://jina.ai/?sui=apikey
 *
 * This API client implements basic functions to work with:
 * - Embeddings API: Generate fixed-length embeddings for texts/images.
 * - Reader API: Scrape a webpage and return its LLM-friendly content.
 * - Reranker API: Rerank a list of documents based on a query.
 * - Classifier API: Zero-shot classify texts (or images).
 * - Segmenter API: Break text content into manageable chunks.
 *
 * Make sure to set the environment variable `JINA_API_KEY` before running.
 */

const JINA_API_KEY = process.env.JINA_API_KEY;
if (!JINA_API_KEY) {
  throw new Error(
    "JINA_API_KEY environment variable is not set. Please set it to your Jina AI API key."
  );
}

const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Helper function for performing fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = RETRY_COUNT
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
      return response;
    } catch (err) {
      if (attempt < retries - 1) {
        console.warn(
          `Attempt ${attempt + 1} failed; retrying in ${RETRY_DELAY_MS}ms…`,
          err
        );
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      } else {
        console.error(`Failed after ${retries} attempts:`, err);
        throw err;
      }
    }
  }
  throw new Error("Unreachable code in fetchWithRetry");
}

interface EmbeddingInput {
  text?: string;
  image?: string;
}

interface EmbeddingObject {
  embedding: number[]; // The vector representation
  index: number; // Position in the input array
  object: "embedding"; // Always "embedding"
}

interface EmbeddingUsage {
  total_tokens: number; // Total tokens processed
  prompt_tokens?: number; // Tokens in the prompt (if applicable)
}

interface EmbeddingsResponse {
  data: EmbeddingObject[];
  usage: EmbeddingUsage;
  model: string; // Model used for embedding
  object: "list"; // Always "list"
}

/**
 * Function: getEmbeddings
 * Calls the Embeddings API to convert text/images to fixed-length vectors.
 */
export async function getEmbeddings(params: {
  input: EmbeddingInput[];
  model?: string;
  task?: string;
  dimensions?: number;
}): Promise<EmbeddingsResponse> {
  try {
    const url = "https://api.jina.ai/v1/embeddings";

    const payload = {
      model: params.model || "jina-clip-v2",
      input: params.input,
      normalized: true,
      embedding_type: "float",
      task: params.task || undefined,
      dimensions: params.dimensions || 1024,
    };

    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Full API Error Response:", errorText);
      throw new Error(
        `API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return (await response.json()) as EmbeddingsResponse;
  } catch (error) {
    console.error("Error in getEmbeddings:", error);
    throw error;
  }
}

/**
 * Function: readUrl
 * Calls the Reader API to retrieve/parse content from a URL.
 */
export async function readUrl(
  urlToRead: string,
  readerOptions: string = "Default"
): Promise<any> {
  try {
    const endpoint = "https://r.jina.ai/";
    const payload = {
      url: urlToRead,
      options: readerOptions,
    };

    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    console.error("Error in readUrl:", error);
    throw error;
  }
}

/**
 * Function: rerank
 * Uses the Reranker API to re-rank search results based on a query.
 */
export async function rerank(
  query: string,
  documents: string[],
  params: { model: string; top_n?: number; return_documents?: boolean }
): Promise<any> {
  try {
    const endpoint = "https://api.jina.ai/v1/rerank";
    const payload = {
      model: params.model,
      query: query,
      documents: documents,
      top_n: params.top_n,
      return_documents:
        params.return_documents !== undefined ? params.return_documents : true,
    };

    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    console.error("Error in rerank:", error);
    throw error;
  }
}

/**
 * Function: segmentText
 * Calls the Segmenter API to divide a long text into semantic chunks.
 */
export async function segmentText(
  content: string,
  options?: {
    tokenizer?: string;
    return_tokens?: boolean;
    return_chunks?: boolean;
    max_chunk_length?: number;
    head?: number;
    tail?: number;
  }
): Promise<any> {
  try {
    const endpoint = "https://segment.jina.ai/";
    const payload = {
      content: content,
      tokenizer: options?.tokenizer || "cl100k_base",
      return_tokens: options?.return_tokens || false,
      return_chunks: options?.return_chunks || false,
      max_chunk_length: options?.max_chunk_length || 1000,
      head: options?.head,
      tail: options?.tail,
    };

    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    console.error("Error in segmentText:", error);
    throw error;
  }
}
