/**
 * W7 — Fleet. Fixture data seeding `MockFleetAdapter`, transcribed exactly
 * from the design mock's own JS state
 * (`docs/rework/design/src/Chorus Remake.dc.html`, `renderVals()` — the
 * `machines` / `kanban` / `features` / cost-preset literals around lines
 * 1320-1362) and cross-checked against `docs/rework/design/fleet.md` and
 * `docs/rework/agents/W7-fleet.md`'s fixture summary.
 *
 * Every session/ticket carries real `Date`s computed relative to a `now`
 * passed in at construction time (not frozen ISO strings) so the "queued
 * 4m" / "12m · $0.84" / "yesterday" style relative labels
 * (`kanbanFormat.ts` / `worktreeFormat.ts`) stay correct no matter when the
 * app is opened — see time.ts.
 */

import {
    IFeature,
    IFleetCostPreset,
    IFleetSession,
    IMachine,
} from "./protocol";
import { daysAgo, hoursAgo, minutesAgo } from "./time";

export function createFixtureMachines(): IMachine[] {
    return [
        {
            id: "m4-mini",
            name: "m4-mini",
            status: "online",
            load: { current: 2, max: 2 },
        },
        {
            id: "hetzner-01",
            name: "hetzner-01",
            status: "online",
            load: { current: 1, max: 4 },
        },
        {
            id: "gpu-box",
            name: "gpu-box",
            status: "idle",
            load: { current: 0, max: 1 },
        },
    ];
}

export function createFixtureSessions(now: Date): IFleetSession[] {
    return [
        // Queued
        {
            id: "sess-quota-ui",
            title: "Add quota meters to model picker",
            agent: "codex",
            machine: "auto",
            branch: "feat/quota-ui",
            status: "queued",
            createdAt: minutesAgo(now, 4),
            updatedAt: minutesAgo(now, 4),
        },
        {
            id: "sess-sectors",
            title: "Vault: backfill sector pages",
            agent: "claude-code",
            machine: "hetzner-01",
            branch: "chore/sectors",
            status: "queued",
            createdAt: minutesAgo(now, 11),
            updatedAt: minutesAgo(now, 11),
        },
        // Running
        {
            id: "sess-oauth-refresh",
            title: "fix: oauth token refresh",
            agent: "claude-code",
            machine: "m4-mini",
            branch: "fix/oauth-refresh",
            status: "running",
            createdAt: minutesAgo(now, 12),
            updatedAt: now,
            progressPct: 72,
            logTail: "▸ RefreshScheduler.test.ts 41/44",
            costUsd: 0.84,
            featureId: "feat-oauth-refresh",
        },
        {
            id: "sess-wiki-indexer",
            title: "wiki-indexer nightly",
            agent: "codex",
            machine: "hetzner-01",
            branch: "cron/indexer",
            status: "running",
            createdAt: hoursAgo(now, 2),
            updatedAt: now,
            progressPct: 31,
            logTail: "▸ ingested 214/680 filings",
            costUsd: 0.12,
        },
        // Needs review
        {
            id: "sess-agents-dash-review",
            title: "Fleet dashboard build ✦",
            agent: "claude-code",
            machine: "m4-mini",
            branch: "feat/agents-dash",
            status: "needs-review",
            createdAt: minutesAgo(now, 40),
            updatedAt: now,
            progressPct: 100,
            logTail: "▸ acceptance 4/4 ✓ · awaiting you",
            diffAdded: 412,
            diffRemoved: 38,
            awaitingReview: true,
            featureId: "feat-agents-dash",
        },
        // Merged
        {
            id: "sess-profiles-merged",
            title: "Model profiles in composer",
            agent: "claude-code",
            machine: "m4-mini",
            branch: "main ← feat/profiles",
            status: "merged",
            createdAt: daysAgo(now, 1),
            updatedAt: daysAgo(now, 1),
            progressPct: 100,
        },
        {
            id: "sess-minimize-merged",
            title: "Auto-minimize empty responses",
            agent: "codex",
            machine: "hetzner-01",
            branch: "main ← fix/minimize",
            status: "merged",
            createdAt: daysAgo(now, 2),
            updatedAt: daysAgo(now, 2),
            progressPct: 100,
        },
    ];
}

export function createFixtureFeatures(now: Date): IFeature[] {
    return [
        {
            id: "feat-agents-dash",
            branch: "feat/agents-dash",
            title: "Fleet dashboard",
            worktreePath: "~/fleet/wt/agents-dash",
            status: "building",
            createdAt: daysAgo(now, 1),
            updatedAt: now,
            supervisor: {
                state: "idle",
                note: "spawns when T-103 lands → reviews all diffs, merges ticket worktrees into feat branch",
            },
            tickets: [
                {
                    id: "T-101",
                    title: "Sessions socket client",
                    worktreePath: "wt/agents-dash/t101",
                    status: "merged",
                    createdAt: daysAgo(now, 1),
                    updatedAt: daysAgo(now, 1),
                },
                {
                    id: "T-102",
                    title: "Log pane virtualization",
                    worktreePath: "wt/agents-dash/t102",
                    status: "merged",
                    createdAt: daysAgo(now, 1),
                    updatedAt: daysAgo(now, 1),
                },
                {
                    id: "T-103",
                    title: "Status columns UI",
                    worktreePath: "wt/agents-dash/t103",
                    status: "running",
                    progressPct: 64,
                    createdAt: minutesAgo(now, 12),
                    updatedAt: now,
                    sessionId: undefined,
                },
            ],
        },
        {
            id: "feat-oauth-refresh",
            branch: "fix/oauth-refresh",
            title: "OAuth token refresh",
            worktreePath: "~/fleet/wt/oauth-refresh",
            status: "supervising",
            createdAt: minutesAgo(now, 30),
            updatedAt: minutesAgo(now, 2),
            supervisor: {
                state: "reviewing",
                note: "diffing T-201 + T-202 → merge to parent worktree, then PR to main",
            },
            tickets: [
                {
                    id: "T-201",
                    title: "Refresh scheduler",
                    worktreePath: "wt/oauth-refresh/t201",
                    status: "awaiting-merge",
                    createdAt: minutesAgo(now, 30),
                    updatedAt: minutesAgo(now, 5),
                },
                {
                    id: "T-202",
                    title: "Retry backoff tests",
                    worktreePath: "wt/oauth-refresh/t202",
                    status: "awaiting-merge",
                    createdAt: minutesAgo(now, 28),
                    updatedAt: minutesAgo(now, 5),
                },
            ],
        },
    ];
}

export function createFixtureCostPresets(): IFleetCostPreset[] {
    return [
        {
            id: "economy",
            name: "Economy",
            roles: {
                planner: { agent: "claude-code", modelLabel: "Sonnet 4.5" },
                worker: { agent: "claude-code", modelLabel: "Haiku 4.5" },
                supervisor: { agent: "claude-code", modelLabel: "Sonnet 4.5" },
            },
            estimateText:
                "est $0.40–0.90 per feature · lint/test passes fall back to local qwen3 (free)",
        },
        {
            id: "balanced",
            name: "Balanced",
            roles: {
                planner: { agent: "claude-code", modelLabel: "Sonnet 4.5" },
                worker: { agent: "claude-code", modelLabel: "Sonnet 4.5" },
                supervisor: { agent: "claude-code", modelLabel: "Opus 4.5" },
            },
            estimateText:
                "est $1.50–3.00 per feature · quota-aware: falls to GPT-5.2 when Anthropic meter > 90%",
        },
        {
            id: "max-quality",
            name: "Max quality",
            roles: {
                planner: { agent: "claude-code", modelLabel: "Opus 4.5" },
                worker: { agent: "claude-code", modelLabel: "Opus 4.5" },
                supervisor: { agent: "claude-code", modelLabel: "Opus 4.5" },
            },
            estimateText:
                "est $5–9 per feature · cross-review pass by GPT-5.2-codex before merge",
        },
    ];
}

/** Matches the design mock's default (`costPreset: 1` = "Balanced" — index 1 of [Economy, Balanced, Max quality]). */
export const FLEET_DEFAULT_COST_PRESET_ID = "balanced";
