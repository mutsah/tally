import { Prisma } from '@prisma/client';
import { serializeDecimals } from './decimal-to-string.interceptor';

describe('serializeDecimals (money-as-string)', () => {
  it('converts a Prisma Decimal to a 2-decimal string', () => {
    expect(serializeDecimals(new Prisma.Decimal('1250'))).toBe('1250.00');
    expect(serializeDecimals(new Prisma.Decimal('1250.5'))).toBe('1250.50');
    expect(serializeDecimals(new Prisma.Decimal('0.1'))).toBe('0.10');
  });

  it('converts Decimal fields inside an object to strings, not numbers', () => {
    const out = serializeDecimals({
      id: 'tx1',
      amount: new Prisma.Decimal('99.9'),
      note: 'hi',
    }) as Record<string, unknown>;
    expect(out.amount).toBe('99.90');
    expect(typeof out.amount).toBe('string');
    expect(out.id).toBe('tx1');
    expect(out.note).toBe('hi');
  });

  it('handles arrays and nested structures', () => {
    const out = serializeDecimals({
      data: [
        { amount: new Prisma.Decimal('5') },
        { amount: new Prisma.Decimal('7.25') },
      ],
      total: 2,
    }) as { data: Array<{ amount: unknown }>; total: number };
    expect(out.data.map((d) => d.amount)).toEqual(['5.00', '7.25']);
    expect(out.total).toBe(2);
  });

  it('leaves dates, numbers, strings, null untouched', () => {
    const date = new Date('2026-06-29T00:00:00.000Z');
    expect(serializeDecimals(date)).toBe(date);
    expect(serializeDecimals(42)).toBe(42);
    expect(serializeDecimals('x')).toBe('x');
    expect(serializeDecimals(null)).toBeNull();
  });
});
