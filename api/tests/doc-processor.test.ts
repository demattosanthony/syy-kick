import { expect, test, describe, beforeAll } from "bun:test";
import { encoding_for_model, TiktokenModel } from "tiktoken";

import {
  sanitizeText,
  createSuperChunks,
  findBestSuperChunk,
} from "../app/doc-processor";

// Helper function to get token count
function getTokenCount(
  text: string,
  model: TiktokenModel = "gpt-4o-mini"
): number {
  const enc = encoding_for_model(model);
  const tokenCount = enc.encode(text).length;
  enc.free();
  return tokenCount;
}

describe("sanitizeText", () => {
  test("removes null bytes", () => {
    const text = "Hello\0World\0!";
    expect(sanitizeText(text)).toBe("HelloWorld!");
  });

  test("removes invalid UTF-8 characters", () => {
    const text = "Hello\uFFFDWorld\uFFFE\uFFFF";
    expect(sanitizeText(text)).toBe("HelloWorld");
  });

  test("normalizes Unicode characters", () => {
    // Using composed and decomposed forms of 'é'
    const text = "café\u0065\u0301"; // café with decomposed 'é'
    expect(sanitizeText(text)).toBe("caféé"); // The function correctly normalizes but keeps both characters
  });

  test("removes control characters but keeps newlines and tabs", () => {
    const text = "Hello\n\tWorld\x00\x01\x02\x03\x04";
    expect(sanitizeText(text)).toBe("Hello\n\tWorld");
  });

  test("trims whitespace", () => {
    const text = "  \n  Hello World  \t\n  ";
    expect(sanitizeText(text)).toBe("Hello World");
  });

  test("handles empty string", () => {
    expect(sanitizeText("")).toBe("");
  });

  test("preserves valid text", () => {
    const text = "Hello World! This is a normal sentence.";
    expect(sanitizeText(text)).toBe(text);
  });

  test("handles multiple issues simultaneously", () => {
    const text = "\0  Hello\uFFFD\x01World\n\t\uFFFF  ";
    expect(sanitizeText(text)).toBe("HelloWorld"); // The function removes all control chars including \n\t
  });
});

describe("createSuperChunks", () => {
  // Generate a long text that will require multiple chunks
  const generateLongText = (size: number): string => {
    // Create a text with approximately 'size' tokens
    // Note: This is an approximation as the actual token count depends on the tokenizer
    const words = [
      "hello",
      "world",
      "test",
      "chunk",
      "token",
      "count",
      "verify",
      "document",
      "processing",
    ];
    let text = "";
    // Each word is roughly 1-2 tokens, aim for size * 0.8 words to be safe
    for (let i = 0; i < size * 0.8; i++) {
      text += words[i % words.length] + " ";
      // Add newlines occasionally to simulate document structure
      if (i % 20 === 0) text += "\n";
    }
    return text;
  };

  test("creates correct number of chunks", () => {
    const fullText = generateLongText(250); // Generate text with ~250 tokens
    const maxTokensPerChunk = 100;

    const superChunks = createSuperChunks(fullText, maxTokensPerChunk);

    // Should create approximately 3 chunks (250 / 100 = 2.5, rounded up to 3)
    expect(superChunks.length).toBeGreaterThanOrEqual(2);
    expect(superChunks.length).toBeLessThanOrEqual(4); // Allow for some variance
  });

  test("chunks have correct token counts", () => {
    const fullText = generateLongText(350);
    const maxTokensPerChunk = 100;

    const superChunks = createSuperChunks(fullText, maxTokensPerChunk);

    // Check that all chunks except possibly the last one have approximately maxTokensPerChunk tokens
    for (let i = 0; i < superChunks.length - 1; i++) {
      expect(superChunks[i].tokenCount).toBeGreaterThanOrEqual(
        maxTokensPerChunk * 0.9
      ); // Allow 10% tolerance
      expect(superChunks[i].tokenCount).toBeLessThanOrEqual(
        maxTokensPerChunk * 1.1
      ); // Allow 10% tolerance
    }

    // The last chunk might have fewer tokens
    expect(superChunks[superChunks.length - 1].tokenCount).toBeLessThanOrEqual(
      maxTokensPerChunk
    );
  });

  test("chunk text content is correct", () => {
    const fullText =
      "This is a test document. It has multiple sentences that should be chunked appropriately.";
    const maxTokensPerChunk = 50; // This should be enough for the entire text

    const superChunks = createSuperChunks(fullText, maxTokensPerChunk);

    // For a small document that fits in one chunk, we should get the exact same text back
    expect(superChunks.length).toBe(1);
    expect(superChunks[0].text).toBe(fullText);
  });

  test("very large document is properly chunked", () => {
    const fullText = generateLongText(1000); // 1000 token document
    const maxTokensPerChunk = 250;

    const superChunks = createSuperChunks(fullText, maxTokensPerChunk);

    // Should create 4-5 chunks of approximately equal size
    expect(superChunks.length).toBeGreaterThanOrEqual(3);
    expect(superChunks.length).toBeLessThanOrEqual(6); // Allow for some variance

    // Check chunk sizes
    for (const chunk of superChunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(maxTokensPerChunk);
    }

    // Ensure all text is included (reconstructing the document)
    const reconstructed = superChunks.map((c) => c.text).join("");
    // Due to token counting and decoding, there might be small differences, but
    // the core content should be preserved
    expect(reconstructed.length).toBeGreaterThanOrEqual(fullText.length * 0.9);
  });
});

describe("findBestSuperChunk", () => {
  let superChunks: Array<{
    text: string;
    tokenCount: number;
    startChar: number;
    endChar: number;
  }>;

  beforeAll(() => {
    // Create test super chunks
    const chunk1 =
      "This is the first super chunk with some specific content that we'll look for.";
    const chunk2 =
      "This is the second super chunk with different content and some terms we might search for.";
    const chunk3 =
      "The third super chunk contains more technical details and specifications about HVAC systems.";

    let startChar = 0;
    superChunks = [
      {
        text: chunk1,
        tokenCount: getTokenCount(chunk1),
        startChar: startChar,
        endChar: startChar + chunk1.length,
      },
      {
        text: chunk2,
        tokenCount: getTokenCount(chunk2),
        startChar: startChar + chunk1.length,
        endChar: startChar + chunk1.length + chunk2.length,
      },
      {
        text: chunk3,
        tokenCount: getTokenCount(chunk3),
        startChar: startChar + chunk1.length + chunk2.length,
        endChar: startChar + chunk1.length + chunk2.length + chunk3.length,
      },
    ];
  });

  test("finds exact match in a chunk", () => {
    const targetText = "specific content that we'll look for";
    const bestChunk = findBestSuperChunk(superChunks, targetText);

    expect(bestChunk).toBe(superChunks[0]); // Should match first chunk
  });

  test("finds chunk with partial match", () => {
    const targetText = "different content and some terms";
    const bestChunk = findBestSuperChunk(superChunks, targetText);

    expect(bestChunk).toBe(superChunks[1]); // Should match second chunk
  });

  test("finds closest chunk when text spans boundaries", () => {
    // A text that spans the boundary between chunk1 and chunk2
    const targetText = "for. This is the second";
    const bestChunk = findBestSuperChunk(superChunks, targetText);

    // Depending on implementation, could be chunk1 or chunk2, but should be one of them
    expect([superChunks[0], superChunks[1]]).toContain(bestChunk);
  });

  test("returns first chunk as fallback when text not found", () => {
    const targetText = "This content doesn't exist in any of the chunks";
    const bestChunk = findBestSuperChunk(superChunks, targetText);

    expect(bestChunk).toBe(superChunks[0]); // Should default to first chunk
  });

  test("handles empty input text", () => {
    const targetText = "";
    const bestChunk = findBestSuperChunk(superChunks, targetText);

    expect(bestChunk).toBe(superChunks[0]); // Should default to first chunk
  });

  test("works with single chunk document", () => {
    const singleChunk = [
      {
        text: "This is the only chunk in the document",
        tokenCount: 8,
        startChar: 0,
        endChar: 36,
      },
    ];

    const targetText = "only chunk";
    const bestChunk = findBestSuperChunk(singleChunk, targetText);

    expect(bestChunk).toBe(singleChunk[0]);
  });
});
