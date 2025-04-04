import { generateText, tool } from "ai";
import { z } from "zod";
import { MODELS } from "../../models";

export const createWebSearchTool = () =>
  tool({
    description: `Search the web for public information.

When to use:
- Product manuals and technical specifications
- Industry standards and building codes
- Manufacturer documentation
- General knowledge questions

When NOT to use:
- Project-specific information (use search_project_information instead)
- Information about your specific building or equipment
- Content in your uploaded documents

Tips:
- Use specific search terms including manufacturer names and model numbers
- Add "pdf" when looking for technical documents`,
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const { text, sources, providerMetadata } = await generateText({
        model: MODELS["gemini-2.0-flash-online"].model,
        prompt: `Search the web for information on "${query}"`,
        maxTokens: 1200,
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

      return {
        text: formattedText,
        sources: processedSources,
        queries: groundingMetadata?.webSearchQueries,
      };
    },
  });
