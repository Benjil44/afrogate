import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateCustomerDisplayName,
  DISPLAY_NAME_ALPHABET,
  DISPLAY_NAME_CODE_LENGTH,
} from '../src/billing/display-name.ts';

describe('generateCustomerDisplayName (unbiased via crypto.randomInt)', () => {
  it('maps each drawn index onto the lookalike-free alphabet in Customer-XXXXXX form', () => {
    const indices = [0, 1, 2, 3, 4, 5];
    let i = 0;
    const name = generateCustomerDisplayName(() => indices[i++]);
    assert.equal(name, 'Customer-ABCDEF');
  });

  it('requests one uniform index per character, strictly within the alphabet bounds', () => {
    // Regression guard for CodeQL js/biased-cryptographic-random: the fixed
    // implementation asks randomInt for [0, alphabet.length) per character. The
    // old biased code consumed raw bytes and reduced them with `% length` - it
    // would never make these draws, so a silent revert fails here.
    const requested: number[] = [];
    generateCustomerDisplayName((max) => {
      requested.push(max);
      return 0;
    });
    assert.equal(requested.length, DISPLAY_NAME_CODE_LENGTH);
    for (const max of requested) assert.equal(max, DISPLAY_NAME_ALPHABET.length);
  });

  it('covers the full alphabet as the index sweeps its range (uniform, order-preserving)', () => {
    // index i -> alphabet[i]; sweeping 0..30 must reproduce the alphabet exactly.
    assert.equal(DISPLAY_NAME_ALPHABET.length, 31);
    for (let idx = 0; idx < DISPLAY_NAME_ALPHABET.length; idx++) {
      const name = generateCustomerDisplayName(() => idx);
      assert.equal(name, `Customer-${DISPLAY_NAME_ALPHABET[idx].repeat(DISPLAY_NAME_CODE_LENGTH)}`);
    }
  });

  it('keeps the lookalike-free contract: no 0/O or 1/I/L can ever appear', () => {
    assert.doesNotMatch(DISPLAY_NAME_ALPHABET, /[0O1IL]/);
    const shape = new RegExp(`^Customer-[${DISPLAY_NAME_ALPHABET}]{${DISPLAY_NAME_CODE_LENGTH}}$`);
    for (let i = 0; i < 64; i++) {
      // real crypto.randomInt default - format contract, not a statistical test
      assert.match(generateCustomerDisplayName(), shape);
    }
  });
});
