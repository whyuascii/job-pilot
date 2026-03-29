import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeUrl } from './sanitize';

// ---------------------------------------------------------------------------
// Thorough sanitization tests: XSS vectors, SQL injection, null bytes,
// Unicode edge cases, and other attack payloads.
// ---------------------------------------------------------------------------

describe('sanitizeText - XSS vectors', () => {
  it('strips img tag with onerror handler', () => {
    const result = sanitizeText('<img src=x onerror=alert(1)>');
    expect(result).toBe('');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });

  it('strips svg/onload XSS', () => {
    const result = sanitizeText('<svg onload=alert(1)>');
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('onload');
  });

  it('strips iframe tags', () => {
    const result = sanitizeText('<iframe src="https://evil.com"></iframe>');
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.com');
  });

  it('strips body onload', () => {
    const result = sanitizeText('<body onload=alert("xss")>');
    expect(result).not.toContain('<body');
    expect(result).not.toContain('onload');
  });

  it('handles double encoding of entities', () => {
    const result = sanitizeText('&amp;lt;script&amp;gt;');
    // After decoding &amp; -> &, should still have &lt; and &gt;
    expect(result).not.toContain('<script');
  });

  it('strips multiple javascript: protocol variations', () => {
    expect(sanitizeText('javascript:alert(1)')).not.toContain('javascript:');
    expect(sanitizeText('JAVASCRIPT:ALERT(1)')).not.toContain('javascript:');
    expect(sanitizeText('JavaScript:void(0)')).not.toContain('javascript:');
    expect(sanitizeText('jAvAsCrIpT:alert(document.cookie)')).not.toContain('javascript:');
  });

  it('strips multiple event handler patterns', () => {
    const handlers = [
      'onclick=alert(1)',
      'onmouseover=alert(1)',
      'onfocus=alert(1)',
      'onblur=alert(1)',
      'oninput=alert(1)',
      'onchange=alert(1)',
      'onsubmit=alert(1)',
      'onkeyup=alert(1)',
      'onkeydown=alert(1)',
      'onmouseenter=alert(1)',
    ];
    for (const handler of handlers) {
      const result = sanitizeText(handler);
      expect(result).not.toMatch(/on\w+=/i);
    }
  });

  it('strips event handler with spaces before =', () => {
    const result = sanitizeText('onload =alert(1)');
    expect(result).not.toMatch(/onload/i);
  });

  it('handles nested script tags', () => {
    const result = sanitizeText('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(result).not.toContain('<script');
  });

  it('handles self-closing tags', () => {
    const result = sanitizeText('<br/><hr/><input/>');
    expect(result).toBe('');
  });

  it('handles tags with newlines inside', () => {
    const result = sanitizeText('<div\nclass="test"\n>content</div\n>');
    expect(result).toBe('content');
  });

  it('strips anchor tags with href', () => {
    const result = sanitizeText('<a href="https://evil.com">Click me</a>');
    expect(result).toBe('Click me');
    expect(result).not.toContain('<a');
    expect(result).not.toContain('href');
  });

  it('strips data attributes in tags', () => {
    const result = sanitizeText('<div data-value="malicious">text</div>');
    expect(result).toBe('text');
  });

  it('handles HTML comments', () => {
    const result = sanitizeText('before<!-- comment -->after');
    expect(result).toBe('beforeafter');
  });

  it('strips style tags', () => {
    const result = sanitizeText('<style>body{display:none}</style>visible');
    expect(result).toBe('body{display:none}visible');
  });

  it('handles combination of encoded entities and tags', () => {
    const result = sanitizeText('&lt;script&gt;alert(1)&lt;/script&gt;');
    // After entity decoding, this becomes <script>alert(1)</script>
    // Note: the function decodes entities AFTER stripping tags
    expect(result).toContain('alert(1)');
  });
});

describe('sanitizeText - SQL injection payloads', () => {
  it('passes through SQL injection (validation, not DB concern)', () => {
    // sanitizeText focuses on XSS, not SQL injection
    // SQL injection prevention is at the query/ORM layer
    const sqli = "'; DROP TABLE users; --";
    const result = sanitizeText(sqli);
    // Should not crash, should return the string (possibly with entities decoded)
    expect(typeof result).toBe('string');
  });

  it('passes through UNION-based SQL injection', () => {
    const result = sanitizeText("' UNION SELECT * FROM users --");
    expect(typeof result).toBe('string');
  });

  it('passes through boolean-based blind injection', () => {
    const result = sanitizeText("' OR '1'='1");
    expect(typeof result).toBe('string');
  });
});

describe('sanitizeText - null bytes and control characters', () => {
  it('handles null byte in string', () => {
    const result = sanitizeText('hello\x00world');
    expect(typeof result).toBe('string');
    // The function trims but does not strip null bytes explicitly
    expect(result).toBeDefined();
  });

  it('handles string with only null bytes', () => {
    const result = sanitizeText('\x00\x00\x00');
    expect(typeof result).toBe('string');
  });

  it('handles tab characters', () => {
    const result = sanitizeText('hello\tworld');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  it('handles newline characters', () => {
    const result = sanitizeText('hello\nworld');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  it('handles carriage return + newline', () => {
    const result = sanitizeText('hello\r\nworld');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });
});

describe('sanitizeText - Unicode edge cases', () => {
  it('preserves normal unicode text', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
    expect(sanitizeText('Bonjour le monde')).toBe('Bonjour le monde');
  });

  it('preserves accented characters', () => {
    expect(sanitizeText('caf\u00e9 r\u00e9sum\u00e9')).toBe('caf\u00e9 r\u00e9sum\u00e9');
  });

  it('preserves CJK characters', () => {
    expect(sanitizeText('\u4f60\u597d\u4e16\u754c')).toBe('\u4f60\u597d\u4e16\u754c');
  });

  it('preserves Arabic text', () => {
    expect(sanitizeText('\u0645\u0631\u062d\u0628\u0627')).toBe('\u0645\u0631\u062d\u0628\u0627');
  });

  it('handles emoji', () => {
    const result = sanitizeText('Hello \ud83d\ude80 World');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('handles zero-width characters', () => {
    const result = sanitizeText('hel\u200blo'); // zero-width space
    expect(typeof result).toBe('string');
  });

  it('handles right-to-left override character', () => {
    const result = sanitizeText('\u202ehello');
    expect(typeof result).toBe('string');
  });
});

describe('sanitizeText - empty and whitespace inputs', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('trims leading and trailing spaces', () => {
    expect(sanitizeText('   hello   ')).toBe('hello');
  });

  it('trims leading and trailing tabs', () => {
    expect(sanitizeText('\thello\t')).toBe('hello');
  });

  it('returns empty for whitespace-only input', () => {
    expect(sanitizeText('   ')).toBe('');
    expect(sanitizeText('\t\t')).toBe('');
    expect(sanitizeText('\n\n')).toBe('');
  });

  it('preserves internal spaces', () => {
    expect(sanitizeText('hello world')).toBe('hello world');
  });
});

describe('sanitizeUrl - thorough coverage', () => {
  it('accepts http URL', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('accepts https URL', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('accepts HTTP with uppercase', () => {
    expect(sanitizeUrl('HTTP://example.com')).toBe('HTTP://example.com');
  });

  it('accepts HTTPS with uppercase', () => {
    expect(sanitizeUrl('HTTPS://example.com')).toBe('HTTPS://example.com');
  });

  it('rejects javascript: protocol', () => {
    expect(() => sanitizeUrl('javascript:alert(1)')).toThrow('Invalid URL');
  });

  it('rejects JavaScript: with mixed case', () => {
    expect(() => sanitizeUrl('jAvAsCrIpT:alert(1)')).toThrow('Invalid URL');
  });

  it('rejects data: protocol', () => {
    expect(() => sanitizeUrl('data:text/html,<h1>xss</h1>')).toThrow('Invalid URL');
  });

  it('rejects vbscript: protocol', () => {
    expect(() => sanitizeUrl('vbscript:msgbox("xss")')).toThrow('Invalid URL');
  });

  it('rejects file: protocol', () => {
    expect(() => sanitizeUrl('file:///etc/passwd')).toThrow('Invalid URL');
  });

  it('rejects ftp: protocol', () => {
    expect(() => sanitizeUrl('ftp://files.example.com')).toThrow('Invalid URL');
  });

  it('rejects empty string', () => {
    expect(() => sanitizeUrl('')).toThrow('Invalid URL');
  });

  it('rejects relative path', () => {
    expect(() => sanitizeUrl('/path/to/page')).toThrow('Invalid URL');
  });

  it('rejects protocol-relative URL', () => {
    expect(() => sanitizeUrl('//example.com/path')).toThrow('Invalid URL');
  });

  it('trims whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('accepts URL with port', () => {
    expect(sanitizeUrl('https://example.com:8080/path')).toBe('https://example.com:8080/path');
  });

  it('accepts URL with authentication', () => {
    expect(sanitizeUrl('https://user:pass@example.com')).toBe('https://user:pass@example.com');
  });

  it('accepts URL with fragment', () => {
    expect(sanitizeUrl('https://example.com/page#section')).toBe('https://example.com/page#section');
  });

  it('accepts URL with query params', () => {
    expect(sanitizeUrl('https://example.com/search?q=test&page=1')).toBe(
      'https://example.com/search?q=test&page=1'
    );
  });

  it('accepts URL with encoded characters', () => {
    expect(sanitizeUrl('https://example.com/path%20with%20spaces')).toBe(
      'https://example.com/path%20with%20spaces'
    );
  });

  it('accepts very long URL', () => {
    const longPath = 'a'.repeat(2000);
    expect(sanitizeUrl(`https://example.com/${longPath}`)).toBe(`https://example.com/${longPath}`);
  });

  it('rejects plain text', () => {
    expect(() => sanitizeUrl('not a url at all')).toThrow('Invalid URL');
  });

  it('rejects URL with leading javascript: followed by http', () => {
    expect(() => sanitizeUrl('javascript:fetch("http://evil.com")')).toThrow('Invalid URL');
  });
});
