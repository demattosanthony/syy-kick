import { describe, test, expect, beforeEach } from "bun:test";
import { getPdfPageAsImage } from "../app/utils";
import s3 from "../app/config/s3";

describe("getPdfPageAsImage", () => {
  test("successfully converts PDF page to image", async () => {
    // Create a small test PDF file
    const testPdf = await Bun.file("./tests/example.pdf").bytes();

    const result = await getPdfPageAsImage(testPdf, 1);

    // Verify the result is a non-empty base64 string
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
