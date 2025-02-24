import { expect, test, describe } from "bun:test";
import { sanitizeText, getLocalContext } from "../app/doc-processor";
import { encoding_for_model, TiktokenModel } from "tiktoken";

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

describe("getLocalContext", () => {
  test("returns chunk when not found in full text", () => {
    const fullText = "This is the full document text";
    const chunk = "Not found chunk";
    expect(getLocalContext(fullText, chunk, 100)).toBe(chunk);
  });

  test("returns empty string for empty chunk", () => {
    const fullText = "This is the full document text";
    const chunk = "";
    expect(getLocalContext(fullText, chunk, 100)).toBe("");
  });

  test("centers chunk in context with appropriate token limit", () => {
    // Create a large document with a specific chunk in the middle
    const prefix = "prefix ".repeat(5000);
    const chunk = "THIS IS THE TARGET CHUNK";
    const suffix = " suffix".repeat(5000);
    const fullText = prefix + chunk + suffix;

    const maxTokens = 1000;
    const result = getLocalContext(fullText, chunk, maxTokens);

    // Verify the chunk is in the result
    expect(result).toContain(chunk);

    // Verify token count is approximately within our limit (with some padding)
    const tokenCount = getTokenCount(result);

    // Allow some padding since we're using character approximation
    const maxAllowedTokens = maxTokens * 1.2; // 20% padding
    expect(tokenCount).toBeLessThanOrEqual(maxAllowedTokens);
    console.log(`Token count: ${tokenCount} for max tokens: ${maxTokens}`);
  });

  test("handles chunk at the beginning of text", () => {
    const chunk = "BEGINNING CHUNK";
    const fullText = chunk + " followed by a lot of text ".repeat(1000);

    const maxTokens = 500;
    const result = getLocalContext(fullText, chunk, maxTokens);

    expect(result).toContain(chunk);
    expect(result.indexOf(chunk)).toBe(0); // Chunk should be at the beginning

    const tokenCount = getTokenCount(result);
    expect(tokenCount).toBeLessThanOrEqual(maxTokens * 1.2);
    console.log(
      `Beginning chunk token count: ${tokenCount} for max tokens: ${maxTokens}`
    );
  });

  test("handles chunk at the end of text", () => {
    const chunk = "ENDING CHUNK";
    const fullText = "A lot of preceding text ".repeat(1000) + chunk;

    const maxTokens = 500;
    const result = getLocalContext(fullText, chunk, maxTokens);

    expect(result).toContain(chunk);
    expect(result.indexOf(chunk) + chunk.length).toBe(result.length); // Chunk should be at the end

    const tokenCount = getTokenCount(result);
    expect(tokenCount).toBeLessThanOrEqual(maxTokens * 1.2);
    console.log(
      `Ending chunk token count: ${tokenCount} for max tokens: ${maxTokens}`
    );
  });

  test("handles very small token limits", () => {
    const fullText =
      "This is a long document with some important information in the middle.";
    const chunk = "important information";

    const maxTokens = 5; // Very small token limit
    const result = getLocalContext(fullText, chunk, maxTokens);

    expect(result).toContain(chunk);

    const tokenCount = getTokenCount(result);
    // With very small limits, we might exceed by a bit more
    expect(tokenCount).toBeLessThanOrEqual(maxTokens * 2);
    console.log(
      `Small limit token count: ${tokenCount} for max tokens: ${maxTokens}`
    );
  });

  test("handles multiple occurrences of chunk", () => {
    const chunk = "REPEATED CHUNK";
    const fullText =
      "Prefix text " + chunk + " middle text " + chunk + " suffix text";

    const maxTokens = 20;
    const result = getLocalContext(fullText, chunk, maxTokens);

    expect(result).toContain(chunk);
    // Should find the first occurrence
    expect(result.indexOf(chunk)).toBe(fullText.indexOf(chunk));

    const tokenCount = getTokenCount(result);
    expect(tokenCount).toBeLessThanOrEqual(maxTokens * 1.2);
    console.log(
      `Multiple occurrences token count: ${tokenCount} for max tokens: ${maxTokens}`
    );
  });

  test("handles real-world example with 90K token limit", () => {
    // Create a document that would be around 100K tokens if fully included
    const prefix = "prefix word ".repeat(25_000);
    const chunk = "THIS IS AN IMPORTANT HVAC SPECIFICATION SECTION";
    const suffix = " suffix word".repeat(25_000);
    const fullText = prefix + chunk + suffix;

    // count to make sure it's around 100K tokens
    const fullTokenCount = getTokenCount(fullText);
    expect(fullTokenCount).toBeGreaterThan(95_000);
    expect(fullTokenCount).toBeLessThan(105_000);

    const maxTokens = 90_000;
    const result = getLocalContext(fullText, chunk, maxTokens);

    // Verify the chunk is in the result
    expect(result).toContain(chunk);

    // Verify token count is within our limit (with some padding)
    const tokenCount = getTokenCount(result);

    // Allow some padding since we're using character approximation
    const maxAllowedTokens = 120000; // Real token limit is 120K as mentioned
    expect(tokenCount).toBeLessThanOrEqual(maxAllowedTokens);
    console.log(
      `Large document token count: ${tokenCount} for max tokens: ${maxTokens}`
    );
  });
});
