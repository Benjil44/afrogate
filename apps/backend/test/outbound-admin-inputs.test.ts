/**
 * Admin outbound inputs: the auto-test toggle DTO rejects non-boolean values
 * (a string "false" used to switch tests ON), and adding a subscription whose
 * upstream fetch/parse fails is a 400 with the reason instead of a 500.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundledSkipReason, loadBundled, requireBackendDependency } from './helpers/load-bundled.ts';

describe('UpdateOutboundTestSettingsDto', { skip: bundledSkipReason }, () => {
  const { UpdateOutboundTestSettingsDto } = loadBundled<{ UpdateOutboundTestSettingsDto: new () => object }>(
    'operations/dto/outbound.dto.ts',
  );
  const { plainToInstance } = requireBackendDependency<typeof import('class-transformer')>('class-transformer');
  const { validate } = requireBackendDependency<typeof import('class-validator')>('class-validator');
  const errorsFor = async (payload: object) =>
    (await validate(plainToInstance(UpdateOutboundTestSettingsDto, payload) as object, { whitelist: true })).length;

  it('accepts booleans and an empty body', async () => {
    assert.equal(await errorsFor({ enabled: true }), 0);
    assert.equal(await errorsFor({ enabled: false }), 0);
    assert.equal(await errorsFor({}), 0);
  });

  it('rejects strings and numbers', async () => {
    assert.ok((await errorsFor({ enabled: 'false' })) > 0);
    assert.ok((await errorsFor({ enabled: 1 })) > 0);
  });
});

describe('OperationsService.addOutboundSubscription upstream failure', { skip: bundledSkipReason }, () => {
  type Proto = { addOutboundSubscription(dto: unknown, actor: unknown): Promise<unknown> };
  const { OperationsService } = loadBundled<{ OperationsService: { prototype: Proto } }>(
    'operations/operations.service.ts',
    { quiet: true },
  );
  const { BadRequestException, NotFoundException } = requireBackendDependency<typeof import('@nestjs/common')>(
    '@nestjs/common',
  );

  function call(fetchError: Error) {
    let transactions = 0;
    const self = {
      fetchAndParseSubscription: async () => {
        throw fetchError;
      },
      database: {
        transaction: async () => {
          transactions += 1;
        },
      },
    };
    const promise = OperationsService.prototype.addOutboundSubscription.call(
      self,
      { url: 'https://sub.example.com/x' },
      undefined,
    );
    return { promise, transactions: () => transactions };
  }

  it('maps fetch/HTTP/empty-body failures to 400 with the reason and writes nothing', async () => {
    for (const message of ['fetch failed: ECONNREFUSED', 'HTTP 503', 'No VLESS configs found in subscription']) {
      const { promise, transactions } = call(new Error(message));
      await assert.rejects(promise, (error: unknown) => {
        assert.ok(error instanceof BadRequestException, message);
        assert.match((error as Error).message, new RegExp(message));
        return true;
      });
      assert.equal(transactions(), 0);
    }
  });

  it('passes an HttpException through unchanged', async () => {
    const { promise } = call(new NotFoundException('gone'));
    await assert.rejects(promise, (error: unknown) => error instanceof NotFoundException);
  });
});
