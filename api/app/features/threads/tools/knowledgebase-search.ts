import { tool } from "ai";
import { KnowledgeBase } from "../../../config/schema";
import { ModelConfig } from "../../models";
import { z } from "zod";
import { searchKnowledgeBaseDocuments } from "../../knowledge-bases/knowledge-bases.ops";
import reranker from "../../../config/reranker";
import {
  formatDocumentSearchResults,
  processDocumentImages,
} from "../threads.utils";

export const createKnowledgeBaseSearchTool = (
  modelConfig: ModelConfig,
  knowledgeBase?: KnowledgeBase
) =>
  tool({
    description: `${
      knowledgeBase
        ? `This tool allows you to retrieve information from the "${knowledgeBase.name}" knowledge base.`
        : `This tool allows you to retrieve information from a Knowledge Base.`
    }

Usage:
    1. Use when you need information stored within a designated knowledge base.

Returns:
    - Relevant document excerpts with context
    - Document metadata (name, path)
    - Visual previews for supported document types`,
    parameters: z.object({
      query: z.string(),
      ...(knowledgeBase
        ? {}
        : {
            knowledgeBaseId: z
              .string()
              .describe("The ID of the knowledge base to search within."),
          }),
    }),
    execute: async ({ query, knowledgeBaseId }) => {
      const targetKnowledgeBaseId: string = knowledgeBase
        ? knowledgeBase.id
        : (knowledgeBaseId as string);

      try {
        // Execute the search within the specified knowledge base
        const res = await searchKnowledgeBaseDocuments({
          query,
          knowledgeBaseId: targetKnowledgeBaseId,
          limit: 80, // Same limit as project search for consistency
        });
        console.log(
          `Knowledge base search results for KB ${knowledgeBaseId}:`,
          res.length
        );

        // Rerank results
        const rerankedResults = await reranker.rerank(
          query,
          res.map((r) => r.text || ""),
          {
            topN: 20, // Same topN as project search
            returnDocuments: true,
          }
        );

        // Create a map of text to original result for lookup
        const textToResultMap = new Map(res.map((r) => [r.text, r]));

        // Map reranked results to simplified schema
        // const simplifiedDocs: DocumentSearchToolResult[] =
        //   rerankedResults.results?.map((reranked) => {
        //     const originalDoc = textToResultMap.get(reranked.document.text)!;
        //     return {
        //       documentId: originalDoc.document.id,
        //       // Knowledge bases don't have project IDs, set to null or undefined
        //       projectId: undefined,
        //       path: originalDoc.document.path,
        //       documentName: originalDoc.document.name,
        //       text: originalDoc.text,
        //       similarity: reranked.relevance_score,
        //       pageNumber: (originalDoc.metadata as { page_number?: number })
        //         ?.page_number,
        //       mimeType: originalDoc.document.mimeType,
        //       fileKey: originalDoc.document.fileKey,
        //       // Add knowledgeBaseId for frontend context if needed
        //       knowledgeBaseId: targetKnowledgeBaseId,
        //     };
        //   }) ?? []; // Ensure it defaults to an empty array if results are null/undefined
        // console.log(
        //   "Simplified knowledge base docs length:",
        //   simplifiedDocs.length
        // );

        return "";

        // Generate final output
        // const uniqueDocs = getUniqueDocuments(simplifiedDocs);
        // const images = modelConfig.model.modelId.includes("claude-3.7-sonnet")
        //   ? await processDocumentImages(uniqueDocs)
        //   : [];

        // return formatDocumentSearchResults(uniqueDocs, images);
      } catch (error) {
        console.error(
          `Error searching knowledge base ${targetKnowledgeBaseId}:`,
          error
        );
        // Return a structured error message
        return {
          images: [],
          context: `Error searching knowledge base: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          docs: [],
          dataForFrontend: [],
        };
      }
    },
    // experimental_toToolResultContent(result) {
    //   if (!result || !result.context || result.context.startsWith("Error:")) {
    //     // Handle cases where execute returned an error or no result
    //     return [{ type: "text", text: result?.context || "No results found." }];
    //   }

    //   return [
    //     ...(result.images || []).map((image) => ({
    //       type: "image" as const,
    //       data: image.imageData,
    //       mimeType: image.mimeType,
    //     })),
    //     {
    //       type: "text",
    //       text: result.context,
    //     },
    //   ];
    // },
  });
