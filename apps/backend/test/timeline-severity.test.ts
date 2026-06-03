import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  describeRouteDecisionTimelineDetail,
  incidentSeverityFromAlert,
  routeDecisionTimelineSeverity,
  type RouteDecisionTimelineRow,
} from '../src/operations/timeline-severity.ts';

const row = (over: Partial<RouteDecisionTimelineRow>): RouteDecisionTimelineRow => ({
  fromOutboundId: null,
  toOutboundId: null,
  decisionState: 'noChange',
  ...over,
});

describe('incidentSeverityFromAlert', () => {
  it('maps known severities and defaults to info', () => {
    assert.equal(incidentSeverityFromAlert('critical'), 'critical');
    assert.equal(incidentSeverityFromAlert('warning'), 'warning');
    assert.equal(incidentSeverityFromAlert('whatever'), 'info');
  });
});

describe('routeDecisionTimelineSeverity', () => {
  it('warns on an actual route change', () => {
    assert.equal(routeDecisionTimelineSeverity(row({ fromOutboundId: 'a', toOutboundId: 'b' }), []), 'warning');
  });

  it('info when from==to (no real change) and no concerns', () => {
    assert.equal(routeDecisionTimelineSeverity(row({ fromOutboundId: 'a', toOutboundId: 'a' }), []), 'info');
  });

  it('warns on a health-concern reason code (case-insensitive, substring)', () => {
    assert.equal(routeDecisionTimelineSeverity(row({}), ['high_PacketLoss_detected']), 'warning');
    assert.equal(routeDecisionTimelineSeverity(row({}), ['latencySpike']), 'warning');
  });

  it('warns when the decision state is switchRecommended', () => {
    assert.equal(routeDecisionTimelineSeverity(row({ decisionState: 'switchRecommended' }), []), 'warning');
  });

  it('info for a benign reason code', () => {
    assert.equal(routeDecisionTimelineSeverity(row({}), ['cooldown_active']), 'info');
  });
});

describe('describeRouteDecisionTimelineDetail', () => {
  it('shows a route change with names and top-3 reasons', () => {
    const detail = describeRouteDecisionTimelineDetail(
      row({ fromOutboundName: 'EU-1', toOutboundName: 'EU-2', fromOutboundId: 'a', toOutboundId: 'b' }),
      ['r1', 'r2', 'r3', 'r4'],
    );
    assert.equal(detail, 'EU-1 -> EU-2 / r1, r2, r3');
  });

  it('falls back to ids when names are missing', () => {
    const detail = describeRouteDecisionTimelineDetail(row({ fromOutboundId: 'a', toOutboundId: 'b' }), []);
    assert.equal(detail, 'a -> b');
  });

  it('shows reasons only when there is no route change', () => {
    assert.equal(describeRouteDecisionTimelineDetail(row({}), ['only_reason']), 'only_reason');
  });

  it('falls back to the decision state when nothing else is available', () => {
    assert.equal(describeRouteDecisionTimelineDetail(row({ decisionState: 'noChange' }), []), 'noChange');
  });
});
