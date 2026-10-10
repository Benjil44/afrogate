import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { isDeLinkFailure } from './germany-mgmt-backoff';
import { remoteAddUserArgs, remoteReadUsageArgs, remoteRemoveUserArgs, buildRemoteAduJson } from './germany-mgmt';
import type { RemoteExitMgmtDeps } from './remote-exit-mgmt';

/**
 * Nest-side wiring shared by every remote exit (Germany, USA): the real ssh
 * exec, ConfigService-backed env reads, and the argv/adu builders. Each site's
 * service supplies only what differs (label, enable gate, target/key, inbound,
 * its OWN breaker).
 */

/** Hard process timeout per ssh call (bounds a hang beyond ConnectTimeout). */
const SSH_TIMEOUT_MS = 20_000;

/**
 * ssh runs ProxyCommand through $SHELL. The backend user `afrows` has
 * /usr/sbin/nologin as its shell (systemd exports it), which makes a
 * ProxyCommand hop (the USA's nc -> us-mgmt-socks) fail with "This account is
 * currently not available". Pin a real shell for the child only.
 */
const SSH_ENV = { ...process.env, SHELL: '/bin/sh' };

export function execSsh(args: string[], stdin?: string): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const opts = { timeout: SSH_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, env: SSH_ENV };
    const child = execFile('ssh', args, opts, (error, stdout) => {
      if (error) reject(error);
      else resolve({ stdout });
    });
    if (stdin !== undefined) child.stdin?.end(stdin);
  });
}

/** ConfigService value with a process.env fallback (matches the pre-refactor reads). */
export function envValue(config: ConfigService, key: string): string | undefined {
  return config.get<string>(key) ?? process.env[key];
}

export function sshRemoteExitDeps(
  site: Pick<RemoteExitMgmtDeps, 'label' | 'enabled' | 'config' | 'inbound' | 'backoff'>,
  loggerName: string,
): RemoteExitMgmtDeps {
  return {
    ...site,
    isLinkFailure: isDeLinkFailure,
    readUsageArgs: remoteReadUsageArgs,
    removeUserArgs: remoteRemoveUserArgs,
    addUserArgs: remoteAddUserArgs,
    buildAduJson: buildRemoteAduJson,
    exec: execSsh,
    logger: new Logger(loggerName),
  };
}

export function portFromEnv(raw: string | undefined, fallback: number): number {
  const n = Number((raw ?? '').trim());
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : fallback;
}
