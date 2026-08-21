export const meta = {
  name: 'engineering-task',
  description: 'Afrows engineering orchestrator: knowledge context -> impact -> parallel specialists -> integration barrier -> validation',
  whenToUse:
    'Any non-trivial Afrows engineering task that benefits from evidence-first impact analysis and parallel specialists. Pass {task, mode, scope, constraints, riskLevel}. mode "analyze" is a read-only dry run.',
  phases: [
    { title: 'Discovery', detail: 'load knowledge context + deterministic impact report' },
    { title: 'Decompose', detail: 'work packages with explicit file ownership' },
    { title: 'Implement', detail: 'parallel specialists, worktree-isolated writers' },
    { title: 'Integrate', detail: 'conflict barrier + adversarial reviewer' },
    { title: 'Validate', detail: 'targeted tests, then broader gates when evidence demands' },
  ],
};

// ---------------------------------------------------------------------------
// Afrows engineering orchestrator.
//
// Contract (docs/orchestration-contract.md) in one line:
//   task -> knowledge context -> impact -> decompose -> parallel -> barrier ->
//   targeted validation -> broader validation -> report (commit/push stay human-gated)
//
// Deliberate design decisions:
//  * The knowledge/authority rules are NOT restated here. AGENTS.md is the single
//    source; every agent is told to read it. Restating would create a second,
//    drifting copy.
//  * Parallel WRITERS get isolation:'worktree'. The repo has a recorded incident
//    where one agent's `git stash` swept other agents' uncommitted edits in the
//    shared tree (.claude/agents/README.md). Read-only agents share the tree.
//  * The script never commits or pushes. It returns a plan; a human-directed
//    main loop performs side effects (Checklist 14).
//  * Determinism lives in scripts/orchestration/impact-report.mjs, not in agent
//    prose. Agents run it and report its output.
// ---------------------------------------------------------------------------

const input = args || {};
const task = input.task || '(no task given)';
const mode = input.mode === 'implement' ? 'implement' : 'analyze'; // default: safe dry run
const scope = input.scope || 'unspecified';
const constraints = input.constraints || 'Follow AGENTS.md. Never touch scripts/mikrotik/village-wan-failover-recursive.rsc.';
const declaredRisk = input.riskLevel || 'unknown';
const maxWorkers = Math.max(1, Math.min(Number(input.maxParallel) || 3, 4));

const NEVER_TOUCH = [
  'scripts/mikrotik/village-wan-failover-recursive.rsc',
  'knowledge/** (generated - change scripts/knowledge/ generators instead)',
  '.env, .env.* (secrets)',
];

const RULES = [
  'Read AGENTS.md first, especially "Engineering Knowledge Layer - Operating Contract". It is authoritative; do not restate or override it.',
  'Authority order: migrations + apps + tests > schema.ts > bridges/test_links/service_links > AST > communities > docs > memory.',
  'Label every claim VERIFIED / DERIVED / INFERRED / AMBIGUOUS. Never present INFERRED as fact.',
  'If the knowledge manifest SHA != HEAD, treat ALL derived knowledge as HINTS ONLY and re-verify against source.',
  'Absence of a link is NOT proof of no dependency. When in doubt, read the source.',
  'NEVER run `git stash`, `git checkout -- .`, or `git reset --hard` - a past incident destroyed other agents\' work.',
  'Do not commit, push, merge, bump versions, or regenerate the Graphify graph.',
  `Never modify: ${NEVER_TOUCH.join(' | ')}`,
];

const SCHEMA_IMPACT = {
  type: 'object',
  additionalProperties: false,
  required: ['freshness', 'overall_risk', 'likely_files', 'summary'],
  properties: {
    freshness: { type: 'string', description: 'FRESH | STALE | UNKNOWN, verbatim from the impact report' },
    freshness_warning: { type: 'string' },
    overall_risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    likely_files: { type: 'array', items: { type: 'string' } },
    dependents: { type: 'array', items: { type: 'string' } },
    depends_on: { type: 'array', items: { type: 'string' } },
    tables: { type: 'array', items: { type: 'string' } },
    co_consumers: { type: 'array', items: { type: 'string' } },
    tests_verified: { type: 'array', items: { type: 'string' } },
    adrs_invariants: { type: 'array', items: { type: 'string' } },
    broader_validation_required: { type: 'boolean' },
    broader_validation_reasons: { type: 'array', items: { type: 'string' } },
    ambiguities: { type: 'array', items: { type: 'string' }, description: 'things evidence could NOT establish' },
    summary: { type: 'string' },
  },
};

const SCHEMA_PLAN = {
  type: 'object',
  additionalProperties: false,
  required: ['work_packages', 'parallel_safe', 'rationale'],
  properties: {
    work_packages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'goal', 'agent', 'owned_files', 'forbidden_files', 'can_parallel'],
        properties: {
          id: { type: 'string' },
          goal: { type: 'string' },
          agent: {
            type: 'string',
            description:
              'one of: senior-backend-engineer, senior-frontend-designer, network-infra-engineer, qa-tester, telegram-bot-ux-designer, cto-architect',
          },
          owned_files: { type: 'array', items: { type: 'string' } },
          forbidden_files: { type: 'array', items: { type: 'string' } },
          depends_on: { type: 'array', items: { type: 'string' } },
          tests: { type: 'array', items: { type: 'string' } },
          risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          writes_files: { type: 'boolean' },
          can_parallel: { type: 'boolean' },
        },
      },
    },
    parallel_safe: { type: 'boolean', description: 'false if any two parallel packages share an owned file' },
    conflicts: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
  },
};

// Checklist 15 - the standard agent result contract.
const SCHEMA_RESULT = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'files_changed', 'implementation_summary', 'ready_for_integration'],
  properties: {
    status: { type: 'string', enum: ['DONE', 'BLOCKED', 'NEEDS_REVIEW'] },
    files_changed: { type: 'array', items: { type: 'string' } },
    files_forbidden_touched: { type: 'array', items: { type: 'string' } },
    implementation_summary: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    unresolved: { type: 'array', items: { type: 'string' } },
    conflict_detected: { type: 'string', description: 'set if this package overlaps another agent; orchestrator resolves' },
    ready_for_integration: { type: 'boolean' },
  },
};

const SCHEMA_REVIEW = {
  type: 'object',
  additionalProperties: false,
  required: ['findings', 'ready_to_commit', 'verdict'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'summary'],
        properties: {
          severity: { type: 'string', enum: ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW'] },
          file: { type: 'string' },
          summary: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    forbidden_files_touched: { type: 'array', items: { type: 'string' } },
    scope_violations: { type: 'array', items: { type: 'string' } },
    duplicate_or_contradictory: { type: 'array', items: { type: 'string' } },
    worktrees_harvested: { type: 'array', items: { type: 'string' }, description: 'agent worktree paths whose diffs were applied to the main tree' },
    harvest_conflicts: { type: 'array', items: { type: 'string' } },
    ready_to_commit: { type: 'boolean' },
    verdict: { type: 'string' },
  },
};

const SCHEMA_VALIDATION = {
  type: 'object',
  additionalProperties: false,
  required: ['gates', 'all_passed'],
  properties: {
    gates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'command', 'result'],
        properties: {
          name: { type: 'string' },
          command: { type: 'string' },
          result: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
          detail: { type: 'string' },
          failure_class: {
            type: 'string',
            enum: ['NEW_REGRESSION', 'PRE_EXISTING', 'ENVIRONMENT', 'FLAKY', 'UNKNOWN', 'NONE'],
          },
          evidence: { type: 'string', description: 'required to justify any non-NEW_REGRESSION classification' },
        },
      },
    },
    all_passed: { type: 'boolean' },
    notes: { type: 'string' },
  },
};

const preamble = `You are working in the Afrows monorepo (Windows, git-bash available).

TASK: ${task}
SCOPE: ${scope}
CONSTRAINTS: ${constraints}
DECLARED RISK: ${declaredRisk}
MODE: ${mode}

NON-NEGOTIABLE RULES:
${RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

// ---- STAGE 1: DISCOVERY + IMPACT -------------------------------------------
phase('Discovery');
log(`mode=${mode} | max parallel writers=${maxWorkers}`);

const impact = await agent(
  `${preamble}
STAGE: DISCOVERY + IMPACT_ANALYSIS (read-only - change nothing).

Do this in order:
1. Read AGENTS.md (whole file) and .claude/memory.md.
2. Work out which files this task most likely touches. Read them and their imports.
3. Run the deterministic impact analyzer and use its output as your evidence base:
     node scripts/orchestration/impact-report.mjs <file> [<file>...]
   (add --json for machine output). Report its freshness verdict VERBATIM.
4. Read the owning module MOC under knowledge/modules/ and any table MOCs it names.
5. Read docs/adr/ + docs/invariants.md entries that constrain this area.

Answer the impact questions from EVIDENCE: which files change, who depends on them,
what they depend on, which tables, who else touches those tables, which tests are
deterministically linked, which ADRs/invariants apply, and the risk level.

List honestly in "ambiguities" everything the evidence could NOT establish.
Do not guess. Do not edit any file.`,
  { label: 'discovery+impact', phase: 'Discovery', schema: SCHEMA_IMPACT, agentType: 'general-purpose' },
);

if (!impact) {
  return { stage: 'DISCOVERY', status: 'BLOCKED', reason: 'impact analysis agent returned nothing' };
}
log(`impact: risk=${impact.overall_risk} freshness=${impact.freshness} files=${(impact.likely_files || []).length} tests=${(impact.tests_verified || []).length}`);
if (impact.freshness !== 'FRESH') log(`WARNING: knowledge is ${impact.freshness} - all derived findings are HINTS ONLY.`);

// ---- STAGE 2: DECOMPOSE ----------------------------------------------------
phase('Decompose');
const plan = await agent(
  `${preamble}
STAGE: DECOMPOSE (planning only - change nothing).

Impact evidence:
${JSON.stringify(impact, null, 2)}

Break the task into the SMALLEST set of work packages that actually covers it.
Rules:
- Assign an agent by the FILES and RISK involved, never by role name aesthetics.
    apps/backend, packages/shared        -> senior-backend-engineer
    apps/dashboard, apps/web, apps/client -> senior-frontend-designer
    xray / WireGuard / MikroTik / routing -> network-infra-engineer
    tests/**, reproduction, regression guards -> qa-tester
    telegram bot flow/copy                -> telegram-bot-ux-designer
    cross-cutting architecture/security   -> cto-architect
- Every package needs explicit owned_files and forbidden_files.
- Two packages may only run in parallel if their owned_files are DISJOINT.
  If they would share a file, either merge them or sequence them with depends_on.
- Set writes_files=false for pure analysis packages.
- Keep it to at most ${maxWorkers} parallel packages.

Set parallel_safe=false and list conflicts if any parallel packages share a file.`,
  { label: 'decompose', phase: 'Decompose', schema: SCHEMA_PLAN, agentType: 'scrum-master' },
);

if (!plan || !plan.work_packages || !plan.work_packages.length) {
  return { stage: 'DECOMPOSE', status: 'BLOCKED', impact, reason: 'no work packages produced' };
}

// Deterministic re-check of the agent's parallel-safety claim (never trust prose).
const ownership = new Map();
const overlaps = [];
for (const wp of plan.work_packages) {
  for (const f of wp.owned_files || []) {
    if (ownership.has(f) && ownership.get(f) !== wp.id) overlaps.push(`${f}: ${ownership.get(f)} vs ${wp.id}`);
    ownership.set(f, wp.id);
  }
}
log(`plan: ${plan.work_packages.length} package(s); file overlaps detected: ${overlaps.length}`);

if (mode === 'analyze') {
  return {
    stage: 'DRY_RUN_COMPLETE',
    status: 'DONE',
    mode,
    task,
    impact,
    plan,
    deterministic_overlap_check: { overlaps, parallel_safe: overlaps.length === 0 },
    note: 'analyze mode: no files were modified, no agents wrote code, nothing was committed.',
  };
}

if (overlaps.length) {
  return {
    stage: 'DECOMPOSE',
    status: 'BLOCKED',
    impact,
    plan,
    reason: 'work packages claim parallelism but share owned files',
    overlaps,
  };
}

// ---- STAGE 3: PARALLEL EXECUTION -------------------------------------------
phase('Implement');
const runnable = plan.work_packages.filter((w) => !w.depends_on || !w.depends_on.length);
const deferred = plan.work_packages.filter((w) => w.depends_on && w.depends_on.length);
log(`implementing ${runnable.length} package(s) in parallel; ${deferred.length} deferred by dependency`);

const results = await parallel(
  runnable.map((wp) => () =>
    agent(
      `${preamble}
STAGE: IMPLEMENT - work package ${wp.id}

GOAL: ${wp.goal}
YOU OWN (may edit ONLY these): ${(wp.owned_files || []).join(', ') || '(none - analysis only)'}
FORBIDDEN (must not touch): ${(wp.forbidden_files || []).join(', ') || '(none listed)'} ${NEVER_TOUCH.join(' | ')}
TESTS TO RUN: ${(wp.tests || []).join(', ') || '(select from test_links.json evidence)'}

Impact evidence for context:
${JSON.stringify(impact, null, 2)}

Rules for this package:
- Edit ONLY your owned files. If the work genuinely requires touching a file you do
  not own, STOP, set status=BLOCKED and put the detail in conflict_detected. Do not
  edit it. Another agent may own it right now.
- Run your linked tests before and after your change; report both.
- Do NOT commit, push, or bump the version.
- Report honestly: if something is unverified, put it in assumptions or unresolved.`,
      {
        label: `impl:${wp.id}`,
        phase: 'Implement',
        schema: SCHEMA_RESULT,
        agentType: wp.agent || 'general-purpose',
        // Worktree isolation ONLY for writers - prevents the shared-tree incident.
        ...(wp.writes_files === false ? {} : { isolation: 'worktree' }),
      },
    ).then((r) => (r ? { ...r, package_id: wp.id } : { status: 'BLOCKED', package_id: wp.id, implementation_summary: 'agent returned nothing (timeout or error)', files_changed: [], ready_for_integration: false })),
  ),
);

const collected = results.filter(Boolean);
const failed = collected.filter((r) => r.status === 'BLOCKED' || r.ready_for_integration === false);
const conflicts = collected.filter((r) => r.conflict_detected);
log(`implement done: ${collected.length} result(s), ${failed.length} blocked/not-ready, ${conflicts.length} conflict(s)`);

if (conflicts.length) {
  return {
    stage: 'IMPLEMENT',
    status: 'BLOCKED',
    reason: 'agent(s) reported a scope conflict - orchestrator must re-decompose',
    impact,
    plan,
    results: collected,
    conflicts: conflicts.map((c) => ({ package_id: c.package_id, conflict: c.conflict_detected })),
  };
}

// ---- STAGE 3b: F9 MATERIALIZATION GATE (before spending a review cycle) -----
// The workflow sandbox cannot import scripts/orchestration/execution-state.mjs
// (that pure module is the tested source of truth, apps/backend/test/
// execution-state.test.ts); this mirrors its classify/fallback logic. Two real
// runs (SSRF, ReDoS) produced empty deliverables yet still ran a full
// adversarial review on nothing. Detect IMPLEMENTATION_MISSING here and return
// WITHOUT paying for the reviewer.
const expectedWriters = runnable.filter((w) => w.writes_files !== false).length;
const changedOwnedFiles = collected.reduce((n, r) => n + ((r.files_changed && r.files_changed.length) || 0), 0);
const tier = (impact.overall_risk || 'MEDIUM'); // best signal available inside the workflow
if (expectedWriters > 0 && changedOwnedFiles === 0) {
  const highRisk = tier === 'HIGH';
  return {
    stage: 'IMPLEMENT',
    status: 'BLOCKED',
    execution_state: 'IMPLEMENTATION_MISSING',
    reason:
      'F9 materialization gate: writers were expected but no owned files changed. Review/validation SKIPPED to avoid spending a cycle on an empty deliverable.',
    fallback: highRisk
      ? { action: 'human', reason: 'implementation missing on a high-risk task; require a human to re-dispatch or implement directly' }
      : { action: 'retry-or-serialize', reason: 're-dispatch the writers, or serialize one specialist; do not review nothing' },
    impact,
    plan,
    results: collected,
    expected_writers: expectedWriters,
    changed_owned_files: changedOwnedFiles,
  };
}

// ---- STAGE 4: INTEGRATION BARRIER ------------------------------------------
phase('Integrate');
const review = await agent(
  `${preamble}
STAGE: INTEGRATION BARRIER - harvest, then adversarial review. Last line before commit.

Work package results:
${JSON.stringify(collected, null, 2)}

PART A - HARVEST (mechanical). Parallel writers ran in ISOLATED git worktrees, so
their edits are NOT in the main tree yet. Bring them in:
1. \`git worktree list --porcelain\` - enumerate agent worktrees (skip the main tree).
2. For each agent worktree W: collect BOTH committed work (\`git -C W diff <merge-base>..HEAD\`)
   and uncommitted work (\`git -C W diff\` + \`git -C W diff --cached\`; include untracked
   files via \`git -C W status --porcelain\`).
3. Dry-run each patch against the main tree first: \`git apply --check\`. If two
   worktrees' patches conflict, that is a BLOCKER finding - do NOT resolve it.
4. Apply clean patches to the main tree (\`git apply\`), copying untracked new files
   as needed. Keep the worktrees in place; report their paths for later cleanup.
If there are no agent worktrees (all packages were analysis-only), say so and skip.

PART B - REVIEW the combined diff now sitting in the main tree (git diff / git
status), not just the summaries above.

Check, with evidence:
1. Conflicting edits to the same file or the same logic.
2. Duplicate implementations of the same behaviour across packages.
3. Contradictory architectural decisions between packages.
4. Scope violations - files changed that no package owned.
5. Forbidden files touched. scripts/mikrotik/village-wan-failover-recursive.rsc MUST be
   untracked and unmodified - verify with git status.
6. Secrets, .env files, or unrelated formatting churn.
7. Tests that were weakened to pass rather than fixed.

Classify every finding BLOCKER / HIGH / MEDIUM / LOW.
DO NOT FIX ANYTHING. Report only - the orchestrator decides.
Set ready_to_commit=false if any BLOCKER or HIGH finding exists.`,
  { label: 'integration-review', phase: 'Integrate', schema: SCHEMA_REVIEW, agentType: 'cto-architect' },
);

const blocking = review ? (review.findings || []).filter((f) => f.severity === 'BLOCKER' || f.severity === 'HIGH') : [];
log(`review: ${review ? (review.findings || []).length : 0} finding(s), ${blocking.length} blocking`);

if (!review || blocking.length || review.ready_to_commit === false) {
  return {
    stage: 'INTEGRATION',
    status: 'BLOCKED',
    reason: 'integration barrier found blocking issues; returning to orchestrator without fixing',
    impact,
    plan,
    results: collected,
    review,
    blocking_findings: blocking,
  };
}

// ---- STAGE 5: VALIDATION ---------------------------------------------------
phase('Validate');
const validation = await agent(
  `${preamble}
STAGE: VALIDATION.

Impact evidence (test selection basis):
${JSON.stringify({ tests_verified: impact.tests_verified, broader: impact.broader_validation_required, reasons: impact.broader_validation_reasons, risk: impact.overall_risk }, null, 2)}

Run, in this order, and report each as a gate:
1. Targeted tests from the VERIFIED test links above (smallest complete set).
2. npm run typecheck --workspaces --if-present
3. If broader_validation_required is true, OR risk is HIGH, OR schema/migration/
   shared-infra/auth/financial code changed: npm run test:backend
4. If apps/dashboard, apps/web, apps/client or tests/e2e changed: npm run build
   --workspaces --if-present and npm run test:e2e
5. npm run secrets:check

Report the REAL result of every gate. Never hide a failure.
For any FAIL, classify failure_class and put the PROOF in evidence:
  NEW_REGRESSION | PRE_EXISTING | ENVIRONMENT | FLAKY | UNKNOWN
You may only claim PRE_EXISTING if you verified it fails on unmodified code too
(e.g. via git stash is FORBIDDEN - use \`git show HEAD:<file>\` or a separate worktree).
Do not commit or push.`,
  { label: 'validation', phase: 'Validate', schema: SCHEMA_VALIDATION, agentType: 'qa-tester' },
);

const gatesFailed = validation ? (validation.gates || []).filter((g) => g.result === 'FAIL') : [];
log(`validation: ${validation ? (validation.gates || []).length : 0} gate(s), ${gatesFailed.length} failing`);

return {
  stage: 'COMPLETE',
  status: validation && validation.all_passed && !gatesFailed.length ? 'READY_FOR_COMMIT' : 'BLOCKED',
  mode,
  task,
  impact,
  plan,
  results: collected,
  review,
  validation,
  failing_gates: gatesFailed,
  next_step:
    validation && validation.all_passed && !gatesFailed.length
      ? 'Human-gated: orchestrator reviews the full diff, then commits atomically per workstream and pushes. CI is the final remote gate.'
      : 'BLOCKED: resolve failing gates before any commit.',
};
