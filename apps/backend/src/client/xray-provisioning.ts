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
  // flow defaults to vision for back-compat; an explicit '' (WS/TLS) omits it,
  // since xtls flow is invalid on non-TLS transports.
  const flow = input.flow ?? 'xtls-rprx-vision';
  const client: Record<string, unknown> = { id: input.uuid, email: input.email, level: 0 };
  if (flow) client.flow = flow;
  return {
    inbounds: [
      {
        tag: input.inboundTag,
        port: input.port,
        protocol: 'vless',
        settings: {
          decryption: 'none',
          clients: [client],
        },
      },
    ],
  };
}

/** Stable, unique provisioning email derived from a client_config id. */
export function provisioningEmail(clientConfigId: string): string {
  return `cc_${clientConfigId}@afrows`;
}

/** One inbound to provision a user onto. */
export interface ProvisioningTarget {
  tag: string;
  port: number;
  flow?: string;
}

/** One xray API endpoint (local Ireland, or the pushed remote Germany one) plus
 *  the inbound target(s) reachable through it. */
export interface ProvisioningEndpoint {
  /** Short label for logs only — never carries secrets. */
  label: string;
  /** `host:port` passed to `xray api --server=`. */
  apiServer: string;
  targets: ProvisioningTarget[];
}

const INT_RE = /^-?\d+$/;

function clampPort(raw: string | undefined, fallback: number): number {
  if (!raw || !INT_RE.test(raw.trim())) return fallback;
  const n = Number(raw.trim());
  return n >= 1 && n <= 65535 ? n : fallback;
}

/**
 * Parses a `tag:port[:flow]` comma list (e.g. "afrows-in:8447,afrows-reality:8443")
 * into targets. A per-inbound flow lets xtls-rprx-vision apply ONLY to the reality
 * inbound. Falls back to a single {tag,port} when the list is empty/blank.
 */
export function parseInboundTargets(
  raw: string | undefined,
  fallbackTag: string,
  fallbackPort: number,
): ProvisioningTarget[] {
  const trimmed = raw?.trim();
  if (trimmed) {
    const out: ProvisioningTarget[] = [];
    for (const part of trimmed.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [tag, portStr, flowStr] = part.split(':').map((s) => s.trim());
      if (tag) out.push({ tag, port: clampPort(portStr, fallbackPort), flow: flowStr || undefined });
    }
    if (out.length) return out;
  }
  return [{ tag: fallbackTag, port: fallbackPort }];
}

/**
 * Builds the ORDERED list of provisioning endpoints from env. Ireland (the local
 * xray) is always first. Germany is APPENDED only when AFROWS_XRAY_DE_API_SERVER is
 * set (default empty = off), because Germany must be PUSHED Ireland→Germany over the
 * village route (Germany→Ireland is blocked). Germany reuses the Ireland inbound tag
 * list unless AFROWS_XRAY_DE_INBOUND_TAGS overrides it.
 */
export function buildProvisioningEndpoints(env: Record<string, string | undefined>): ProvisioningEndpoint[] {
  const localApi = env.AFROWS_XRAY_API_SERVER?.trim() || '127.0.0.1:10085';
  const fallbackTag = env.AFROWS_XRAY_INBOUND_TAG?.trim() || 'afrows-in';
  const fallbackPort = clampPort(env.AFROWS_XRAY_INBOUND_PORT, 8443);
  const localTargets = parseInboundTargets(env.AFROWS_XRAY_INBOUND_TAGS, fallbackTag, fallbackPort);

  const endpoints: ProvisioningEndpoint[] = [{ label: 'ie', apiServer: localApi, targets: localTargets }];

  const deApi = env.AFROWS_XRAY_DE_API_SERVER?.trim();
  if (deApi) {
    const deTags = env.AFROWS_XRAY_DE_INBOUND_TAGS?.trim() || 'afrows-de-in:8443';
    endpoints.push({
      label: 'de',
      apiServer: deApi,
      targets: parseInboundTargets(deTags, 'afrows-de-in', clampPort(env.AFROWS_XRAY_DE_INBOUND_PORT, 8443)),
    });
  }
  return endpoints;
}

/**
 * Runs `apply` for every (endpoint, target) pair, catching per-call errors so one
 * endpoint being down (e.g. Germany over the flaky village route) NEVER blocks the
 * others. Returns per-endpoint success keyed by apiServer: true iff at least one of
 * that endpoint's targets applied cleanly. `onError` reports failures for logging.
 */
export async function applyAcrossEndpoints(
  endpoints: ProvisioningEndpoint[],
  apply: (endpoint: ProvisioningEndpoint, target: ProvisioningTarget) => Promise<void>,
  onError?: (endpoint: ProvisioningEndpoint, target: ProvisioningTarget, error: unknown) => void,
): Promise<Map<string, boolean>> {
  const okByEndpoint = new Map<string, boolean>();
  for (const endpoint of endpoints) {
    if (!okByEndpoint.has(endpoint.apiServer)) okByEndpoint.set(endpoint.apiServer, false);
    for (const target of endpoint.targets) {
      try {
        await apply(endpoint, target);
        okByEndpoint.set(endpoint.apiServer, true);
      } catch (error) {
        onError?.(endpoint, target, error);
      }
    }
  }
  return okByEndpoint;
}
