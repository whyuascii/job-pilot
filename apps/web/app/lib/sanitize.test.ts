import { describe, expect, it } from 'vitest';

import { sanitizeText, sanitizeUrl } from './sanitize';

describe('sanitizeText', () => {
  it('returns normal text unchanged', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
  });

  it('strips simple HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
    expect(sanitizeText('<div>content</div>')).toBe('content');
    expect(sanitizeText('<p class="x">para</p>')).toBe('para');
  });

  it('strips script tags and their content markers', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeText('before<script>evil()</script>after')).toBe('beforeevil()after');
  });

  it('strips event handlers like onload and onerror', () => {
    expect(sanitizeText('onload=alert(1)')).toBe('alert(1)');
    expect(sanitizeText('onerror=malicious()')).toBe('malicious()');
    expect(sanitizeText('ONLOAD=x')).toBe('x');
    expect(sanitizeText('onclick=doStuff()')).toBe('doStuff()');
  });

  it('strips javascript: URIs', () => {
    expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeText('JAVASCRIPT:alert(1)')).toBe('alert(1)');
    expect(sanitizeText('JavaScript:void(0)')).toBe('void(0)');
  });

  it('decodes HTML entities', () => {
    expect(sanitizeText('&lt;b&gt;')).toBe('<b>');
    expect(sanitizeText('&amp;')).toBe('&');
    expect(sanitizeText('&quot;hello&quot;')).toBe('"hello"');
    expect(sanitizeText('&#x27;single&#x27;')).toBe("'single'");
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('handles whitespace-only input by trimming', () => {
    expect(sanitizeText('  ')).toBe('');
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('strips nested tags', () => {
    expect(sanitizeText('<div><span><b>deep</b></span></div>')).toBe('deep');
    expect(sanitizeText('<a href="x"><img src="y" /></a>')).toBe('');
  });

  it('handles mixed malicious content', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeText('<a href="javascript:alert(1)">click</a>')).toBe('click');
  });
});

describe('sanitizeUrl', () => {
  it('accepts valid http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    expect(sanitizeUrl('http://example.com/path?q=1')).toBe('http://example.com/path?q=1');
  });

  it('accepts valid https URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('https://sub.example.com/path')).toBe('https://sub.example.com/path');
  });

  it('rejects javascript: URLs', () => {
    expect(() => sanitizeUrl('javascript:alert(1)')).toThrow('Invalid URL');
    expect(() => sanitizeUrl('JAVASCRIPT:alert(1)')).toThrow('Invalid URL');
  });

  it('rejects data: URLs', () => {
    expect(() => sanitizeUrl('data:text/html,<script>alert(1)</script>')).toThrow('Invalid URL');
  });

  it('throws on empty strings', () => {
    expect(() => sanitizeUrl('')).toThrow('Invalid URL');
  });

  it('rejects relative paths', () => {
    expect(() => sanitizeUrl('/path/to/page')).toThrow('Invalid URL');
    expect(() => sanitizeUrl('./relative')).toThrow('Invalid URL');
    expect(() => sanitizeUrl('page.html')).toThrow('Invalid URL');
  });

  it('accepts URLs with special characters', () => {
    expect(sanitizeUrl('https://example.com/path?q=hello%20world&a=1#section')).toBe(
      'https://example.com/path?q=hello%20world&a=1#section'
    );
    expect(sanitizeUrl('https://example.com/search?q=a+b&lang=en')).toBe(
      'https://example.com/search?q=a+b&lang=en'
    );
  });

  it('trims whitespace from URLs', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('rejects ftp: URLs', () => {
    expect(() => sanitizeUrl('ftp://files.example.com')).toThrow('Invalid URL');
  });
});
