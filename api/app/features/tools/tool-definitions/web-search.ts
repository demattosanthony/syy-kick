import { CharacterTextSplitter } from "@langchain/textsplitters";
import reranker from "../../../config/reranker";
import { tool } from "ai";
import { z } from "zod";

/** Processes web content by fetching, chunking, and reranking */
async function processWebContent(
  url: string,
  query: string
): Promise<{
  title: string;
  content: string;
  chunks: string[];
  scores: number[];
  chunksCount: number;
} | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: "Bearer " + process.env.JINA_API_KEY,
        "X-Retain-Images": "none",
        "X-Engine": "direct",
      },
    });

    if (!response.ok) return null;

    const content = await response.text();
    const titleMatch = content.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1] : url;

    const { chunks, scores } = await chunkAndRerankContent(
      content.trim(),
      query
    );

    // Truncate chunks that are too long (keep first 800 chars of each chunk)
    const truncatedChunks = chunks.map((chunk) =>
      chunk.length > 800 ? chunk.substring(0, 800) + "..." : chunk
    );

    return {
      title,
      content: truncatedChunks.join("\n\n---\n\n"),
      chunks: truncatedChunks,
      scores,
      chunksCount: truncatedChunks.length,
    };
  } catch (error) {
    console.error(`Error processing content from ${url}:`, error);
    return null;
  }
}

export const createWebSearchTool = () =>
  tool({
    description: `Web search and content scraping tool that provides access to real-time information from the internet.

This tool performs comprehensive web searches and automatically scrapes content from the top results, giving you access to:
- Current, up-to-date information beyond your training data
- Real-time data from websites, news sources, and technical documentation
- Live content from manufacturer websites, product specifications, and technical resources
- Recent developments, code updates, and industry announcements

The tool can operate in two modes:
1. **Web Search Mode**: Searches the web, retrieves the most relevant results, and automatically fetches and processes the full content from each page
2. **Direct URL Mode**: Directly extracts and processes content from a specific webpage URL

## Parameters

- **query**: The search query to perform OR a description of what you're looking for when using direct URL mode. Be specific and include relevant keywords for better results.
- **url**: Optional direct URL to extract content from. When provided, skips web search and directly processes the specified webpage content.
- **limit**: Optional number of pages to scrape and process (default: 3, max: 5). Only applies to web search mode. Higher limits provide more comprehensive information but take longer to process.

## Usage Tips

**For Web Search Mode:**
- Use specific search terms including manufacturer names, model numbers, and version information
- Add "pdf" when looking for technical documents, manuals, or specifications
- Include year or "latest" for current information (e.g., "React 2024 best practices")
- Use quotes for exact phrases when searching for specific error messages or configurations
- Adjust limit based on need: use 1-2 for quick answers, 3-4 for comprehensive research

**For Direct URL Mode:**
- Provide the complete URL including protocol (https://)
- Use query parameter to describe what specific information you're looking for from that page
- Ideal for extracting content from known documentation pages, articles, or technical resources`,
    parameters: z.object({
      query: z.string(),
      url: z.string().nullable(),
      limit: z.number().nullable(),
    }),
    execute: async ({ query, url, limit }) => {
      console.log("Executing web search tool with query:", query);

      try {
        // Direct URL mode
        if (url) {
          console.log("Using direct URL mode for:", url);
          const processed = await processWebContent(url, query);

          if (!processed) {
            return {
              text: `Error fetching content from URL ${url}`,
              sources: [],
              queries: [query],
            };
          }

          return {
            text: `# Content from: ${processed.title}\n\n**URL:** ${url}\n**Relevant Content:**\n${processed.content}`,
            sources: [
              {
                title: processed.title,
                url: url,
                snippet: processed.chunks[0]?.substring(0, 150) + "..." || "",
                chunksCount: processed.chunksCount,
              },
            ],
            queries: [query],
          };
        }

        // Web search mode
        const response = await fetch(
          `https://s.jina.ai/?q=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: "Bearer " + process.env.JINA_API_KEY,
              "X-Respond-With": "no-content",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const searchResults = await response.text();
        const results = parseSearchResults(searchResults);
        // Reduced default limit from 4 to 3, max 5
        const topResults = results.slice(0, Math.min(limit || 3, 5));

        // Process all URLs in parallel
        const processedResults = await Promise.all(
          topResults.map(async (result) => {
            const processed = await processWebContent(result.url, query);
            return processed
              ? { ...result, ...processed }
              : {
                  ...result,
                  content: "Content unavailable",
                  chunks: [],
                  scores: [],
                  chunksCount: 0,
                };
          })
        );

        // Filter out results with no useful content
        const validResults = processedResults.filter(
          (result) => result.chunksCount > 0
        );

        // Format response - much more concise
        let formattedText = `# Search Results for: ${query}\n\n`;
        let totalLength = formattedText.length;
        const maxLength = 8000; // Set maximum response length

        validResults.forEach((result, index) => {
          const resultText = `## ${result.title}\n**Source:** ${result.url}\n${result.content}\n\n---\n\n`;

          // Only add if we haven't exceeded our length limit
          if (totalLength + resultText.length < maxLength) {
            formattedText += resultText;
            totalLength += resultText.length;
          }
        });

        // Truncate if still too long
        if (formattedText.length > maxLength) {
          formattedText =
            formattedText.substring(0, maxLength - 50) +
            "\n\n[Content truncated for length]";
        }

        return {
          text: formattedText,
          sources: validResults.map((result) => ({
            title: result.title,
            url: result.url,
            snippet: result.chunks[0]?.substring(0, 100) + "..." || "",
            chunksCount: result.chunksCount || 0,
          })),
          queries: [query],
        };
      } catch (error) {
        console.error("Error with web search/content extraction:", error);
        return {
          text: `Error performing web search or content extraction: ${error instanceof Error ? error.message : "Unknown error"}`,
          sources: [],
          queries: [query],
        };
      }
    },
  });

const webContentSplitter = new CharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 120,
  separator: "\n\n",
});

/** Chunks and reranks web content to extract the most relevant information */
async function chunkAndRerankContent(
  content: string,
  query: string
): Promise<{ chunks: string[]; scores: number[] }> {
  try {
    const chunks = await webContentSplitter.splitText(content);
    if (chunks.length === 0) return { chunks: [], scores: [] };

    const batchSize = 45;
    const allRankedChunks: { chunk: string; score: number }[] = [];

    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      try {
        const rerankedResults = await reranker.rerank(query, batch, {
          topN: Math.min(3, batch.length), // Reduced from 5 to 3
          returnDocuments: true,
        });

        rerankedResults.results?.forEach((result) => {
          // Only include chunks with decent relevance scores
          if (result.relevance_score > 0.3) {
            allRankedChunks.push({
              chunk: result.document.text,
              score: result.relevance_score,
            });
          }
        });
      } catch (error) {
        console.error(`Error reranking batch starting at ${i}:`, error);
        // Fallback: add first chunk with default score
        if (batch[0]) {
          allRankedChunks.push({ chunk: batch[0], score: 0.5 });
        }
      }
    }

    // Sort and return top chunks (reduced from 8 to 4)
    allRankedChunks.sort((a, b) => b.score - a.score);
    const topChunks = allRankedChunks.slice(0, 4);

    return {
      chunks: topChunks.map((item) => item.chunk),
      scores: topChunks.map((item) => item.score),
    };
  } catch (error) {
    console.error("Error in chunkAndRerankContent:", error);
    // Fallback: return first part of content (reduced)
    const fallbackChunks = content.substring(0, 2000).split("\n\n").slice(0, 2);
    return {
      chunks: fallbackChunks,
      scores: fallbackChunks.map(() => 0.3),
    };
  }
}

// Helper function to parse search results markdown into structured data
function parseSearchResults(markdown: string): Array<{
  title: string;
  url: string;
  description?: string;
  date?: string;
}> {
  const results: Array<{
    title: string;
    url: string;
    description?: string;
    date?: string;
  }> = [];

  // Split by lines and process each result block
  const lines = markdown.split("\n");
  let currentResult: Partial<{
    title: string;
    url: string;
    description: string;
    date: string;
  }> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match title pattern: [1] Title: ...
    const titleMatch = line.match(/^\[\d+\]\s*Title:\s*(.+)$/);
    if (titleMatch) {
      // If we have a previous result, save it
      if (currentResult.title && currentResult.url) {
        results.push(currentResult as any);
      }
      // Start new result
      currentResult = { title: titleMatch[1] };
      continue;
    }

    // Match URL pattern: [1] URL Source: ...
    const urlMatch = line.match(/^\[\d+\]\s*URL Source:\s*(.+)$/);
    if (urlMatch) {
      currentResult.url = urlMatch[1];
      continue;
    }

    // Match description pattern: [1] Description: ...
    const descMatch = line.match(/^\[\d+\]\s*Description:\s*(.+)$/);
    if (descMatch) {
      currentResult.description = descMatch[1];
      continue;
    }

    // Match date pattern: [1] Date: ...
    const dateMatch = line.match(/^\[\d+\]\s*Date:\s*(.+)$/);
    if (dateMatch) {
      currentResult.date = dateMatch[1];
      continue;
    }
  }

  // Don't forget the last result
  if (currentResult.title && currentResult.url) {
    results.push(currentResult as any);
  }

  return results;
}
