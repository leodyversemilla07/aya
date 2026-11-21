# Agent evaluation harness

Aya's evaluation harness measures whether the agent chooses the right tools, sends valid arguments,
grounds its answer in tool results, and handles failures without inventing data. It provides a
network-free replay mode for CI and an optional live mode for comparing prompts, models, and
providers.

## Quick start

Run the deterministic benchmark:

```bash
pnpm run agent:eval
```

The command builds the API workspace, creates and migrates the dedicated
`packages/db/prisma/agent-eval.db` database, seeds its deterministic staffing dataset, runs all
scenarios, and writes a JSON report to `apps/api/evaluation/reports/replay.json`.

Replay mode does not call an LLM provider or require an API key. It uses checked-in model responses
and executes the real agent loop, tool router, Zod schemas, database queries, conversation handling,
and answer checks.

> [!IMPORTANT]
> Replay mode validates orchestration and the scripted decision path. It cannot detect a prompt-only
> regression because the model is not making the decision. Run live mode before changing the system
> prompt, provider adapter, model, or tool descriptions.

Run the same scenarios against the configured provider:

```bash
pnpm run agent:eval:live
```

Live mode reads `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` from the root `.env`
file. It uses the same dedicated seeded database, so results are not affected by changes to the
development database. Live runs can consume provider tokens and are intentionally not part of CI.

Run one scenario while iterating:

```bash
DATABASE_URL=file:./agent-eval.db pnpm --filter @aya/api run agent:eval -- \
  --mode=replay --scenario=bench-react-developer
```

## Evaluation modes

| Mode | Model source | Network | Intended use |
|------|--------------|---------|--------------|
| Replay | Checked-in response fixtures | No | Fast, deterministic CI regression gate |
| Live | Configured LLM provider | Yes | Prompt, model, and provider comparison |

Both modes execute the production agent service and real database tools. Live mode changes only the
model responses; replay mode changes the model decision source.

## What is measured

Each scenario defines one or more turns with these assertions:

- **Tool sequence** — the exact ordered tools selected by the agent.
- **Tool arguments** — required values that must be present in a selected tool call.
- **Argument validity** — whether every call satisfies the tool's Zod schema.
- **Response content** — required information, accepted alternatives, and forbidden claims.
- **Grounding** — whether named facts appear in both tool output and the final response.
- **Empty and error results** — whether the agent handles no matches, ambiguous clients, and missing
  records safely.

The report aggregates these checks into:

| Metric | Meaning |
|--------|---------|
| Scenario pass rate | Scenarios where every assertion passed |
| Tool selection accuracy | Exact tool-sequence pass rate |
| Argument validity | Tool calls accepted by their Zod schemas |
| Argument expectation rate | Required argument subsets present in the selected calls |
| Grounding rate | Grounding, empty-result, and error-result checks passed |
| Response accuracy | Required and forbidden response checks passed |
| Token usage | Provider input, output, and total tokens when reported |
| Latency | Average and p95 duration per evaluated turn |

The replay baseline in `apps/api/evaluation/baseline.json` requires a 100% pass rate and 100% for
tool selection, schema validity, expected arguments, grounding, and response checks. A regression
exits non-zero and fails CI. Latency and token totals are reported but are not thresholded because
they vary by host.

## Current scenarios

| Scenario | Behavior covered |
|----------|------------------|
| `bench-react-developer` | Skill plus availability filtering |
| `senior-node-developers` | Skill and seniority filtering |
| `match-react-typescript-team` | Ranked project matching |
| `unionbank-utilization` | Client utilization |
| `contracts-expiring-in-thirty-days` | Bounded contract-expiry lookup |
| `unionbank-team-performance` | Team performance lookup |
| `long-bench-alert` | Targeted bench-risk alert |
| `all-staffing-alerts` | Combined risk scan |
| `ambiguous-client-contracts` | Clarification after an ambiguous client match |
| `multi-turn-bench-follow-up` | Context-aware follow-up question |
| `no-developer-match` | Empty roster result without invented candidates |
| `unknown-client-error` | Safe handling of a missing client |

## Reports

Reports are ignored by Git because they contain generated IDs, timestamps, and tool output. The
report includes:

- Aggregate metrics and baseline result
- Per-scenario and per-turn checks
- Selected tool names and arguments
- Tool results used for grounding checks
- Response text, completion count, token usage, and duration

Use `--report=<path>` to write a report elsewhere:

```bash
DATABASE_URL=file:./agent-eval.db pnpm --filter @aya/api run agent:eval -- \
  --mode=live --report=evaluation/live.json
```

## Adding or changing a scenario

Scenarios live in `apps/api/src/agent/evaluation/scenarios.ts`. A scenario contains:

1. One or more prompt turns and their expectations.
2. Replay responses containing the expected tool calls followed by a final answer.
3. Tool arguments validated against the real schemas in `apps/api/src/agent/evaluation/evaluation.spec.ts`.

Keep replay fixtures deterministic and use the current UTC date for project start dates. Grounding
checks should reference names returned by the seeded tools rather than relying only on a fixed
response phrase.

After changing a scenario, run:

```bash
pnpm run agent:eval
pnpm run test
```

## CI behavior

The `verify` CI job runs `pnpm run agent:eval` after unit tests. Replay mode is deterministic and
requires no provider credentials, so a tool-selection, argument, grounding, response, or agent-loop
regression fails the pull request before browser and database integration tests run.
