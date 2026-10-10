import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { US_INBOUND_PORT, US_INBOUND_TAG, isUsMgmtEnabled, resolveUsMgmtConfig } from './germany-mgmt';
import { DeMgmtBackoff, resolveMgmtBackoffConfig } from './germany-mgmt-backoff';
import { RemoteExitMgmt } from './remote-exit-mgmt';
import { envValue, sshRemoteExitDeps } from './remote-exit-ssh';

/**
 * The Ireland->USA remote-exit management channel: same forced-command contract
 * as Germany (read-usage / rmu / adu), inbound afrows-us-ws:10085.
 *
 * OFF unless AFROWS_US_MGMT_ENABLED is truthy — when off every call is a no-op
 * that spawns no ssh, so behaviour is identical to a build without the USA.
 * Target: AFROWS_US_MGMT_SSH (default the ssh_config alias `afrows-us-mgmt`,
 * which carries hostname, key and ProxyCommand); AFROWS_US_MGMT_KEY optional
 * (default empty = no `-i`). Own breaker (AFROWS_US_MGMT_BACKOFF_MAX_SECONDS,
 * default 300 s), so a USA outage never skips Germany's calls.
 */
@Injectable()
export class UsaMgmtService extends RemoteExitMgmt {
  constructor(config: ConfigService) {
    super(
      sshRemoteExitDeps(
        {
          label: 'USA',
          enabled: () => isUsMgmtEnabled({ AFROWS_US_MGMT_ENABLED: envValue(config, 'AFROWS_US_MGMT_ENABLED') }),
          config: () =>
            resolveUsMgmtConfig({
              AFROWS_US_MGMT_SSH: envValue(config, 'AFROWS_US_MGMT_SSH'),
              AFROWS_US_MGMT_KEY: envValue(config, 'AFROWS_US_MGMT_KEY'),
            }),
          inbound: () => ({ tag: US_INBOUND_TAG, port: US_INBOUND_PORT }),
          backoff: new DeMgmtBackoff(resolveMgmtBackoffConfig(envValue(config, 'AFROWS_US_MGMT_BACKOFF_MAX_SECONDS'))),
        },
        UsaMgmtService.name,
      ),
    );
  }
}
