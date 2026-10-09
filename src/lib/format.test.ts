import { describe, expect, it } from 'vitest';
import { fmtCoins } from './format';

describe('fmtCoins', () => {
  it('rounds a stray fraction away instead of showing decimals - coins are always whole numbers', () => {
    expect(fmtCoins(12.7)).toBe('13 Coins');
    expect(fmtCoins(13.13)).toBe('13 Coins');
    expect(fmtCoins(0.4)).toBe('0 Coins');
  });

  it('leaves whole numbers untouched', () => {
    expect(fmtCoins(50)).toBe('50 Coins');
    expect(fmtCoins(0)).toBe('0 Coins');
  });
});
