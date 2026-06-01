/**
 * SSRF policy for the shared outbound HTTP client. Outbound targets are
 * admin/config-controlled (Telegram/PayPal/rewarded-ad webhooks, outbound
 * health probes) and, on restricted servers, are forced through the configured
 * egress proxy. This adds defense-in-depth: only http/https schemes are allowed
 * and well-known cloud metadata endpoints are blocked outright.
 */

const BLOCKED_HOSTS = new Set<string>([
  '169.254.169.254', // AWS/GCP/Azure IMDS
  'metadata.google.internal',
  'metadata.goog',
  'fd00:ec2::254', // AWS IMDSv6
]);

export function assertAllowedOutboundUrl(url: string): URL {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error('Outbound HTTP target is not a valid URL');
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('Outbound HTTP target must use http or https');
  }

  const host = target.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error('Outbound HTTP target is blocked (cloud metadata endpoint)');
  }

  return target;
}
