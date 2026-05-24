import { test, expect } from 'vitest';
import { normalizeUrl, extractUrls } from '../src/services/dedup';

test('normalizeUrl removes tracking params', () => {
  const url = 'https://example.com/page?utm_source=discord&utm_medium=bot&utm_campaign=test';
  const normalized = normalizeUrl(url);
  
  expect(normalized).not.toContain('utm_source');
  expect(normalized).not.toContain('utm_medium');
  expect(normalized).not.toContain('utm_campaign');
});

test('normalizeUrl handles www', () => {
  const withWww = 'https://www.example.com/page';
  const withoutWww = 'https://example.com/page';
  
  expect(normalizeUrl(withWww)).toBe(normalizeUrl(withoutWww));
});

test('normalizeUrl removes trailing slashes', () => {
  const withSlash = 'https://example.com/page/';
  const withoutSlash = 'https://example.com/page';
  
  expect(normalizeUrl(withSlash)).toBe(withoutSlash);
});

test('normalizeUrl preserves root path', () => {
  const root = 'https://example.com/';
  const normalized = normalizeUrl(root);
  
  expect(normalized).toBe('https://example.com/');
});

test('extractUrls finds URLs in content', () => {
  const content = 'Check out https://example.com and https://test.com/path';
  const urls = extractUrls(content);
  
  expect(urls).toHaveLength(2);
  expect(urls[0].original).toBe('https://example.com');
  expect(urls[1].original).toBe('https://test.com/path');
});

test('extractUrls handles multiple URLs', () => {
  const content = 'Links: https://a.com https://b.com https://c.com';
  const urls = extractUrls(content);
  
  expect(urls).toHaveLength(3);
});

test('extractUrls returns empty for no URLs', () => {
  const content = 'No URLs here';
  const urls = extractUrls(content);
  
  expect(urls).toHaveLength(0);
});

test('extractUrls handles edge cases', () => {
  expect(extractUrls('')).toHaveLength(0);
  expect(extractUrls('not a url')).toHaveLength(0);
  expect(extractUrls('https://example.com?a=1&b=2')).toHaveLength(1);
});