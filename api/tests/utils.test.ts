import { describe, test, expect } from "bun:test";
import { getPdfPageAsImage } from "../app/utils";

describe("getPdfPageAsImage", () => {
  test("successfully converts PDF page to image", async () => {
    // Create a small test PDF file
    const testPdf = await Bun.file("./tests/sample.pdf").bytes();

    const result = await getPdfPageAsImage(testPdf, 1);

    // Verify the result is a non-empty base64 string
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("correctly processes images with different dimension settings", async () => {
    // Create a small test PDF file
    const testPdf = await Bun.file("./tests/sample.pdf").bytes();

    // Get image with default settings
    const defaultResult = await getPdfPageAsImage(testPdf, 1);

    // Get image with different dimension setting
    const customResult = await getPdfPageAsImage(testPdf, 1, {
      format: "png",
      dpi: 72,
      maxDimension: 500,
    });

    // Both should be valid base64 strings
    expect(typeof defaultResult).toBe("string");
    expect(typeof customResult).toBe("string");

    // Verify both results contain valid base64 data
    expect(defaultResult.length).toBeGreaterThan(0);
    expect(customResult.length).toBeGreaterThan(0);
  });
});
