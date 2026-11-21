import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEF_INBOUND_PORT, DEF_INBOUND_TAG, isDefMgmtEnabled, resolveDefMgmtConfig } from './germany-mgmt';
import { DeMgmtBackoff, resolveMgmtBackoffConfig } from './germany-mgmt-backoff';
import { RemoteExitMgmt } from './remote-exit-mgmt';
import { envValue, sshRemoteExitDeps } from './remote-exit-ssh';

/**
 * The backend->"Germany Fast x2" remote-exit management channel: same forced-command contract
 * as Germany/USA (read-usage / rmu / adu), but it provisions onto the DIRECT REALITY inbound
 * afrows-def-reality:8443 (not a WS inbound).
 *
 * OFF unless AFROWS_DEF_MGMT_ENABLED is truthy — when off every call is a no-op that spawns no
 * ssh, so behaviour is identical to a build without the Germany-Fast exit. A provisioned DEF user
 * must always be metered, so DEF is never provisioned without its meter (both ride this flag).
 * Target: AFROWS_DEF_MGMT_SSH (default the ssh_config alias `afrows-def-mgmt`, which carries
 * hostname, key and any ProxyCommand); AFROWS_DEF_MGMT_KEY optional (default empty = no `-i`).
 * Own breaker (AFROWS_DEF_MGMT_BACKOFF_MAX_SECONDS, default 300 s), so a DEF outage never skips
 * Germany's or the USA's calls.
 */
@Injectable()
export class DefMgmtService extends RemoteExitMgmt {
  constructor(config: ConfigService) {
    super(
      sshRemoteExitDeps(
        {
          label: 'Germany Fast',
          enabled: () => isDefMgmtEnabled({ AFROWS_DEF_MGMT_ENABLED: envValue(config, 'AFROWS_DEF_MGMT_ENABLED') }),
          config: () =>
            resolveDefMgmtConfig({
              AFROWS_DEF_MGMT_SSH: envValue(config, 'AFROWS_DEF_MGMT_SSH'),
              AFROWS_DEF_MGMT_KEY: envValue(config, 'AFROWS_DEF_MGMT_KEY'),
            }),
          inbound: () => ({ tag: DEF_INBOUND_TAG, port: DEF_INBOUND_PORT }),
          backoff: new DeMgmtBackoff(resolveMgmtBackoffConfig(envValue(config, 'AFROWS_DEF_MGMT_BACKOFF_MAX_SECONDS'))),
        },
        DefMgmtService.name,
      ),
    );
  }
}
