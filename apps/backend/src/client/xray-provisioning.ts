/**
 * Pure helpers for provisioning users into the native Afrows xray inbound
 * (afrows-in) via the xray API. No I/O — the service shells out to `xray api`.
 */

export interface AddUserInput {
  inboundTag: string;
  port: number;
  uuid: string;
  email: string;
  flow?: string;
}

/**
 * Builds the JSON passed to `xray api adu`. The inbound entry MUST carry
 * tag+port+protocol+settings or xray rejects it ("Listen on AnyIP but no Port").
 * Each client needs an `email` so it can be listed/removed later.
 */
export function buildAddUserConfig(input: AddUserInput): Record<string, unknown> {
  return {
    inbounds: [
      {
        tag: input.inboundTag,
        port: input.port,
        protocol: 'vless',
        settings: {
          decryption: 'none',
          clients: [
            {
              id: input.uuid,
              email: input.email,
              flow: input.flow ?? 'xtls-rprx-vision',
              level: 0,
            },
          ],
        },
      },
    ],
  };
}

/** Stable, unique provisioning email derived from a client_config id. */
export function provisioningEmail(clientConfigId: string): string {
  return `cc_${clientConfigId}@afrows`;
}
