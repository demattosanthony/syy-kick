import { expect, test, describe, afterAll } from "bun:test";
import { encoding_for_model, TiktokenModel } from "tiktoken";
import {
  getLocalContextTiktoken,
  substringToMaxTokens,
  sanitizeText,
} from "../app/doc-processor";

describe("getLocalContextTiktoken", () => {
  // Helper function to count tokens
  const countTokens = (text: string, model = "gpt-4o-mini") => {
    const enc = encoding_for_model(model as TiktokenModel);
    const tokens = enc.encode(text);
    enc.free();
    return tokens.length;
  };

  test("returns full text when it's under max tokens", () => {
    const fullText = "This is a short text.";
    const chunk = "short";
    const result = getLocalContextTiktoken(fullText, chunk, "gpt-4o-mini", 100);
    expect(result).toBe(fullText);
  });

  test("returns chunk-centered context when text is too long", () => {
    const fullText = "A ".repeat(10000) + "TARGET" + " B".repeat(10000);
    const chunk = "TARGET";
    const result = getLocalContextTiktoken(fullText, chunk, "gpt-4o-mini", 100);

    expect(result).toContain("TARGET");
    expect(countTokens(result)).toBeLessThanOrEqual(100);

    // Check if context is roughly centered around chunk
    const targetIndex = result.indexOf("TARGET");
    expect(targetIndex).toBeGreaterThan(0);
    expect(targetIndex).toBeLessThan(result.length - 6);
  });

  test("handles chunk not found in text", () => {
    const fullText = "This is some sample text";
    const chunk = "nonexistent";
    const result = getLocalContextTiktoken(fullText, chunk, "gpt-4o-mini", 100);
    expect(result).toBe(fullText);
  });

  test("handles chunk larger than max tokens", () => {
    const chunk = "Very long text ".repeat(100);
    const fullText = "Prefix " + chunk + " Suffix";
    const maxTokens = 10;
    const result = getLocalContextTiktoken(
      fullText,
      chunk,
      "gpt-4o-mini",
      maxTokens
    );

    expect(countTokens(result)).toBeLessThanOrEqual(maxTokens);
  });

  test("maintains chunk integrity", () => {
    const fullText = "Beginning. Important context here. More text.";
    const chunk = "Important context here";
    const result = getLocalContextTiktoken(fullText, chunk, "gpt-4o-mini", 100);

    expect(result).toContain(chunk);
    // Chunk should be preserved exactly as is
    expect(result.indexOf(chunk)).toBeGreaterThan(-1);
  });

  test("respects max tokens limit", () => {
    const fullText = "Very long text ".repeat(1000);
    const chunk = "long text";
    const maxTokens = 50;
    const result = getLocalContextTiktoken(
      fullText,
      chunk,
      "gpt-4o-mini",
      maxTokens
    );

    expect(countTokens(result)).toBeLessThanOrEqual(maxTokens);
  });

  // Cleanup test
  afterAll(() => {
    // Free any remaining encoders
    const enc = encoding_for_model("gpt-4o-mini");
    enc.free();
  });
});

describe("substringToMaxTokens", () => {
  const countTokens = (text: string, model = "gpt-4o-mini") => {
    const enc = encoding_for_model(model as TiktokenModel);
    const tokens = enc.encode(text);
    enc.free();
    return tokens.length;
  };

  test("returns original text when under max tokens", () => {
    const text = "This is a short text";
    const result = substringToMaxTokens(text, "gpt-4o-mini", 100);
    expect(result).toBe(text);
  });

  test("truncates text to respect max tokens", () => {
    const text = "Very long text ".repeat(100);
    const maxTokens = 20;
    const result = substringToMaxTokens(text, "gpt-4o-mini", maxTokens);

    expect(countTokens(result)).toBeLessThanOrEqual(maxTokens);
    expect(result.length).toBeLessThan(text.length);
  });

  test("handles empty string", () => {
    const result = substringToMaxTokens("", "gpt-4o-mini", 10);
    expect(result).toBe("");
  });

  test("handles unicode characters", () => {
    const text = "Hello 👋 World 🌍 ".repeat(100);
    const maxTokens = 15;
    const result = substringToMaxTokens(text, "gpt-4o-mini", maxTokens);

    expect(countTokens(result)).toBeLessThanOrEqual(maxTokens);
    // Should preserve unicode characters in the truncated result
    expect(result).toMatch(/^Hello 👋.*$/);
  });

  test("maintains token boundary integrity", () => {
    const text =
      "This is a complete sentence. " + "Another sentence. ".repeat(100);
    const maxTokens = 10;
    const result = substringToMaxTokens(text, "gpt-4o-mini", maxTokens);

    // Result should be valid UTF-8
    expect(() => new TextEncoder().encode(result)).not.toThrow();
    expect(countTokens(result)).toBeLessThanOrEqual(maxTokens);
  });
});

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
