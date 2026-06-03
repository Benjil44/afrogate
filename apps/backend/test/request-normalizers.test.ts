import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  normalizeAlertStatusParam,
  normalizeLimitParam,
  normalizeRangeHoursParam,
  normalizeSimpleTextParam,
  normalizeUuidParam,
} from '../src/operations/request-normalizers.ts';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('normalizeLimitParam', () => {
  it('defaults when absent and caps at max', () => {
    assert.equal(normalizeLimitParam(undefined, 100, 500), 100);
    assert.equal(normalizeLimitParam('250', 100, 500), 250);
    assert.equal(normalizeLimitParam('9999', 100, 500), 500);
  });

  it('rejects non-positive / non-integer limits', () => {
    for (const v of ['0', '-1', '2.5', 'abc']) {
      assert.throws(() => normalizeLimitParam(v, 100, 500), BadRequestException);
    }
  });
});

describe('normalizeRangeHoursParam', () => {
  it('applies the per-caller default and cap', () => {
    assert.equal(normalizeRangeHoursParam(undefined, 168, 2160), 168);
    assert.equal(normalizeRangeHoursParam(undefined, 24, 2160), 24);
    assert.equal(normalizeRangeHoursParam('9999', 24, 2160), 2160);
    assert.equal(normalizeRangeHoursParam('72', 24, 2160), 72);
  });

  it('rejects invalid ranges', () => {
    assert.throws(() => normalizeRangeHoursParam('0', 24, 2160), BadRequestException);
    assert.throws(() => normalizeRangeHoursParam('1.5', 24, 2160), BadRequestException);
  });
});

describe('normalizeUuidParam', () => {
  it('passes through a valid UUID and undefined for absent', () => {
    assert.equal(normalizeUuidParam(undefined, 'serverId'), undefined);
    assert.equal(normalizeUuidParam(UUID, 'serverId'), UUID);
  });

  it('throws with the field name for a malformed UUID', () => {
    assert.throws(() => normalizeUuidParam('nope', 'serverId'), /serverId must be a UUID/);
  });
});

describe('normalizeAlertStatusParam', () => {
  it('defaults to open and accepts open/resolved', () => {
    assert.equal(normalizeAlertStatusParam(undefined), 'open');
    assert.equal(normalizeAlertStatusParam('open'), 'open');
    assert.equal(normalizeAlertStatusParam('resolved'), 'resolved');
  });

  it('rejects any other status', () => {
    assert.throws(() => normalizeAlertStatusParam('deleted'), BadRequestException);
  });
});

describe('normalizeSimpleTextParam', () => {
  it('passes through simple text and undefined for absent', () => {
    assert.equal(normalizeSimpleTextParam(undefined, 'routeGroup'), undefined);
    assert.equal(normalizeSimpleTextParam('eu-west_1', 'routeGroup'), 'eu-west_1');
  });

  it('rejects values with disallowed characters or bad leading char', () => {
    assert.throws(() => normalizeSimpleTextParam('1bad', 'routeGroup'), /routeGroup must be a simple text filter/);
    assert.throws(() => normalizeSimpleTextParam('has space', 'routeGroup'), BadRequestException);
    assert.throws(() => normalizeSimpleTextParam('a'.repeat(33), 'routeGroup'), BadRequestException);
  });
});
