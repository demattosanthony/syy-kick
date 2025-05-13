import { z } from "zod";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createTool } from "@mastra/core/tools";

export const webSearchTool = createTool({
  id: "Web Search",
  description: `This tool allows you to search the web for public information.`,
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ context }) => {
    const query = context.query;

    const { text, sources, providerMetadata } = await generateText({
      model: google("gemini-2.5-flash-preview-04-17", {
        useSearchGrounding: true,
      }),
      prompt: `Search the web for information on "${query}"`,
      maxTokens: 4000,
      temperature: 0,
    });

    const metadata = providerMetadata?.google as
      | Record<string, any>
      | undefined;
    const groundingMetadata = metadata?.groundingMetadata;
    let formattedText = text;

    // Add citations to text if groundingMetadata exists
    if (groundingMetadata?.groundingSupports?.length) {
      // Sort supports by startIndex descending to avoid position shifts
      const supports = [...groundingMetadata.groundingSupports].sort(
        (a, b) => (b.segment?.startIndex ?? 0) - (a.segment?.startIndex ?? 0)
      );

      for (const support of supports) {
        const { segment, groundingChunkIndices } = support;
        if (
          segment?.endIndex != null &&
          groundingChunkIndices?.length &&
          groundingChunkIndices[0] < sources.length
        ) {
          // Insert citation at the end of the segment
          const sourceIndex = groundingChunkIndices[0];
          formattedText =
            formattedText.substring(0, segment.endIndex) +
            ` [${sourceIndex + 1}]` +
            formattedText.substring(segment.endIndex);
        }
      }
    }

    // Process sources to resolve redirect URLs
    const processedSources = await Promise.all(
      sources.map(async (source) => {
        if (
          source.url?.includes(
            "vertexaisearch.cloud.google.com/grounding-api-redirect"
          )
        ) {
          try {
            const response = await fetch(source.url, {
              method: "HEAD",
              redirect: "manual",
            });
            const location = response.headers.get("location");
            if (location) return { ...source, url: location };
          } catch (error) {
            console.error("Error resolving redirect URL:", error);
          }
        }
        return source;
      })
    );

    // Add citations at the bottom of the text
    const citations = processedSources
      .map((source, index) => `${index + 1}. ${source.url}`)
      .join("\n");

    return {
      text: `${formattedText}\n\nSources:\n${citations}`,
      //   sources: processedSources,
      //   queries: groundingMetadata?.webSearchQueries,
    };
  },
});
