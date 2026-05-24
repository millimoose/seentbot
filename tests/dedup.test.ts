import { describe, expect, test } from "bun:test";
import { normalizeUrl } from "../src/services/dedup.js";

describe("URL normalization", () => {
  test("strips tracking parameters (utm_*)", () => {
    const url = "https://example.com/page?utm_source=twitter&utm_medium=social&utm_campaign=promo";
    const normalized = normalizeUrl(url);
    expect(normalized).toBe("https://example.com/page");
  });

  test("strips fbclid tracking parameter", () => {
    const url = "https://example.com/article?fbclid=abc123&ref=social";
    const normalized = normalizeUrl(url);
    expect(normalized).not.toContain("fbclid");
    expect(normalized).not.toContain("ref");
  });

  test("strips google analytics parameters", () => {
    const url = "https://example.com/product?_ga=1.2.3&_gl=1.2.3";
    const normalized = normalizeUrl(url);
    expect(normalized).not.toContain("_ga");
    expect(normalized).not.toContain("_gl");
  });

  test("normalizes trailing slashes", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
    expect(normalizeUrl("https://example.com/page/")).toBe("https://example.com/page");
    expect(normalizeUrl("https://example.com/page///")).toBe("https://example.com/page");
  });

  test("handles www vs non-www", () => {
    const withWww = normalizeUrl("https://www.example.com/page");
    const withoutWww = normalizeUrl("https://example.com/page");
    expect(withWww).toBe(withoutWww);
  });

  test("converts http to https", () => {
    const httpUrl = "http://example.com/page";
    const normalized = normalizeUrl(httpUrl);
    expect(normalized).toBe("https://example.com/page");
  });

  test("preserves query parameters that are not tracking", () => {
    const url = "https://example.com/search?q=test&page=2";
    const normalized = normalizeUrl(url);
    expect(normalized).toContain("q=test");
    expect(normalized).toContain("page=2");
  });

  test("preserves URL fragments", () => {
    const url = "https://example.com/page#section";
    const normalized = normalizeUrl(url);
    expect(normalized).toContain("#section");
  });

  test("handles complex URLs with multiple tracking params", () => {
    const url =
      "https://example.com/product?utm_source=email&utm_medium=newsletter&mc_cid=abc&fbclid=xyz&gclid=123&q=search";
    const normalized = normalizeUrl(url);
    expect(normalized).toBe("https://example.com/product?q=search");
  });

  test("handles malformed URLs gracefully", () => {
    const malformed = "not-a-url";
    const normalized = normalizeUrl(malformed);
    expect(normalized).toBe("not-a-url");
  });
});