import { limits, sanitizeText, validateAnalyzeInput } from '../lib/validation';

describe('validation', () => {
  test('sanitizeText removes control characters and trims', () => {
    const value = sanitizeText('  hola\u0000\n\n mundo  ');
    expect(value).toBe('hola mundo');
  });

  test('validateAnalyzeInput accepts valid payload', () => {
    const result = validateAnalyzeInput({
      type: 'noticia',
      text: 'a'.repeat(limits.MIN_LENGTH)
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.type).toBe('noticia');
      expect(result.value.text.length).toBeGreaterThanOrEqual(limits.MIN_LENGTH);
    }
  });

  test('validateAnalyzeInput rejects unsupported type', () => {
    const result = validateAnalyzeInput({
      type: 'blog' as never,
      text: 'a'.repeat(limits.MIN_LENGTH)
    });

    expect(result.valid).toBe(false);
  });
});
