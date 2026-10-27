import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseConfigFlag } from '../src/common/config-flag.ts';

describe('parseConfigFlag (shared on/off env parser)', () => {
  it('returns the fallback when unset or blank', () => {
    for (const value of [undefined, null, '', '   ']) {
      assert.equal(parseConfigFlag(value, true), true);
      assert.equal(parseConfigFlag(value, false), false);
    }
  });

  it('accepts 1/true/yes/on case-insensitively with surrounding whitespace', () => {
    for (const value of ['1', 'true', 'TRUE', ' yes ', 'On']) assert.equal(parseConfigFlag(value, false), true);
  });

  it('treats any other explicit value as false (never the fallback)', () => {
    for (const value of ['0', 'false', 'off', 'no', 'enabled', '2']) assert.equal(parseConfigFlag(value, true), false);
  });
});
