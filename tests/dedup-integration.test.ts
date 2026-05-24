import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { extractUrls, extractEmbedUrls, checkDuplicate } from "../src/services/dedup.js";
import { normalizeUrl } from "../src/services/dedup.js";

describe("URL extraction", () => {
  describe("extractUrls", () => {
    test("extracts single URL from content", () => {
      const content = "Check out this link: https://example.com";
      const urls = extractUrls(content);
      expect(urls).toHaveLength(1);
      expect(urls[0].url).toBe("https://example.com/");
    });

    test("extracts multiple URLs from content", () => {
      const content = "Links: https://foo.com and https://bar.com/page?q=1";
      const urls = extractUrls(content);
      expect(urls).toHaveLength(2);
    });

    test("handles empty content", () => {
      const urls = extractUrls("");
      expect(urls).toHaveLength(0);
    });

    test("handles content without URLs", () => {
      const urls = extractUrls("Just a regular message");
      expect(urls).toHaveLength(0);
    });

    test("normalizes extracted URLs", () => {
      const content = "https://www.example.com/page/";
      const urls = extractUrls(content);
      expect(urls[0].url).toBe("https://example.com/page");
    });

    test("returns original URL alongside normalized", () => {
      const content = "Check https://example.com/path";
      const urls = extractUrls(content);
      expect(urls[0].original).toBe("https://example.com/path");
      expect(urls[0].url).toBe("https://example.com/path");
    });
  });

  describe("extractEmbedUrls", () => {
    test("extracts URL from link embed", () => {
      const embeds = [
        {
          type: "link",
          url: "https://example.com/article",
        },
      ] as any;
      const urls = extractEmbedUrls(embeds);
      expect(urls.length).toBeGreaterThanOrEqual(1);
    });

    test("handles empty embeds array", () => {
      const urls = extractEmbedUrls([]);
      expect(urls).toHaveLength(0);
    });

    test("handles null embeds", () => {
      const urls = extractEmbedUrls(null as any);
      expect(urls).toHaveLength(0);
    });
  });
});

// Note: Database integration tests require setting DATABASE_URL before module load.
// For full integration testing, run with: DATABASE_URL="file:./test.db" pnpm test
// Or initialize a separate test database using Prisma migrations.