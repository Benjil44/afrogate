import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DE_INBOUND_PORT, DE_INBOUND_TAG, resolveDeMgmtConfig } from './germany-mgmt';
import { DeMgmtBackoff, resolveMgmtBackoffConfig } from './germany-mgmt-backoff';
import { RemoteExitMgmt } from './remote-exit-mgmt';
import { envValue, portFromEnv, sshRemoteExitDeps } from './remote-exit-ssh';

/**
 * The Ireland->Germany remote-exit management channel (read-usage / rmu / adu
 * over the flaky village link). All behaviour lives in the shared RemoteExitMgmt;
 * this only supplies Germany's config, unchanged from before the USA was added:
 *   AFROWS_DE_MGMT_SSH (default root@162.19.253.235), AFROWS_DE_MGMT_KEY
 *   (default /etc/afrows/de_mgmt_key), inbound AFROWS_XRAY_DE_INBOUND_TAG/PORT
 *   (default afrows-de-ws:8090), breaker cap AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS.
 * Always enabled (as before): callers gate the sweeps on AFROWS_DE_MGMT_SSH /
 * AFROWS_DE_USAGE_ENABLED themselves.
 *
 * While the link is down Germany's OWN circuit breaker skips calls with
 * exponential backoff (15 s doubling, cap 300 s) and logs only the open/close edges.
 */
@Injectable()
export class GermanyMgmtService extends RemoteExitMgmt {
  constructor(config: ConfigService) {
    super(
      sshRemoteExitDeps(
        {
          label: 'Germany',
          enabled: () => true,
          config: () =>
            resolveDeMgmtConfig({
              AFROWS_DE_MGMT_SSH: envValue(config, 'AFROWS_DE_MGMT_SSH'),
              AFROWS_DE_MGMT_KEY: envValue(config, 'AFROWS_DE_MGMT_KEY'),
            }),
          inbound: () => ({
            tag: config.get<string>('AFROWS_XRAY_DE_INBOUND_TAG')?.trim() || DE_INBOUND_TAG,
            port: portFromEnv(envValue(config, 'AFROWS_XRAY_DE_INBOUND_PORT'), DE_INBOUND_PORT),
          }),
          backoff: new DeMgmtBackoff(resolveMgmtBackoffConfig(envValue(config, 'AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS'))),
        },
        GermanyMgmtService.name,
      ),
    );
  }
}
