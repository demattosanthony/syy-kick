interface JinaRerankerResponse {
  model: string;
  usage: {
    total_tokens: number;
  };
  results: {
    index: number;
    document: {
      text: string;
    };
    relevance_score: number;
  }[];
}

class JinaReranker {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.jina.ai/v1/rerank";

  constructor(apiKey: string = process.env.JINA_API_KEY || "") {
    if (!apiKey) {
      throw new Error("JINA_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  async rerank(
    query: string,
    documents: string[],
    options: {
      model?: string;
      topN?: number;
      returnDocuments?: boolean;
    } = {}
  ): Promise<JinaRerankerResponse> {
    const {
      model = "jina-reranker-v2-base-multilingual",
      topN,
      returnDocuments = true,
    } = options;

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          query,
          documents,
          top_n: topN,
          return_documents: returnDocuments,
        }),
      });

      if (!response.ok) {
        throw new Error(`Reranking failed: ${response.statusText}`);
      }

      return (await response.json()) as JinaRerankerResponse;
    } catch (error) {
      throw new Error(
        `Failed to rerank documents: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

const reranker = new JinaReranker();

export default reranker;

// const query = "What is artificial intelligence?";
// const documents = [
//   "AI is a branch of computer science.",
//   "Artificial intelligence involves machine learning.",
//   "AI systems can perform tasks that typically require human intelligence.",
// ];

// try {
//   const results = await reranker.rerank(query, documents, {
//     topN: 2,
//     returnDocuments: true,
//   });
//   console.log(results);
// } catch (error) {
//   console.error("Reranking failed:", error);
// }
