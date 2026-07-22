import { describe, expect, it } from "vitest";
import {
    mapOrcaFeatures,
    mapOrcaLogLine,
    mapOrcaMachines,
    mapOrcaSessions,
    mapOrcaStatus,
    parseOrcaWorktreePs,
} from "./orcaMap";

const now = new Date(2026, 6, 21, 18, 0, 0);

describe("parseOrcaWorktreePs", () => {
    it("reads the assumed { worktrees: [...] } wrapper shape", () => {
        const json = JSON.stringify({ worktrees: [{ id: "wt_1" }] });
        expect(parseOrcaWorktreePs(json)).toEqual([{ id: "wt_1" }]);
    });

    it("also tolerates a bare top-level array", () => {
        const json = JSON.stringify([{ id: "wt_1" }]);
        expect(parseOrcaWorktreePs(json)).toEqual([{ id: "wt_1" }]);
    });

    it("degrades to [] on malformed JSON instead of throwing", () => {
        expect(parseOrcaWorktreePs("not json")).toEqual([]);
    });

    it("degrades to [] when the shape is neither an array nor a { worktrees } object", () => {
        expect(parseOrcaWorktreePs(JSON.stringify({ foo: "bar" }))).toEqual([]);
    });
});

describe("mapOrcaStatus", () => {
    it("maps queued-ish values", () => {
        expect(mapOrcaStatus("queued")).toBe("queued");
        expect(mapOrcaStatus("pending")).toBe("queued");
        expect(mapOrcaStatus("creating")).toBe("queued");
    });

    it("maps needs-review-ish values", () => {
        expect(mapOrcaStatus("needs-review")).toBe("needs-review");
        expect(mapOrcaStatus("needs_review")).toBe("needs-review");
        expect(mapOrcaStatus("review")).toBe("needs-review");
    });

    it("maps merged-ish values", () => {
        expect(mapOrcaStatus("merged")).toBe("merged");
        expect(mapOrcaStatus("done")).toBe("merged");
        expect(mapOrcaStatus("completed")).toBe("merged");
    });

    it("is case-insensitive", () => {
        expect(mapOrcaStatus("MERGED")).toBe("merged");
    });

    it("defaults unknown/unrecognized values to 'running' (conservative default)", () => {
        expect(mapOrcaStatus("idle")).toBe("running");
        expect(mapOrcaStatus("some-future-state")).toBe("running");
        expect(mapOrcaStatus(undefined)).toBe("running");
        expect(mapOrcaStatus(42)).toBe("running");
    });
});

describe("mapOrcaSessions", () => {
    const validJson = JSON.stringify({
        worktrees: [
            {
                id: "wt_9f2a1b",
                name: "fix-oauth-refresh",
                repoId: "chorus",
                branch: "fix/oauth-refresh",
                agent: "claude-code",
                status: "running",
                createdAt: "2026-07-21T17:48:00.000Z",
                updatedAt: "2026-07-21T18:00:00.000Z",
                progressPct: 72,
            },
            {
                id: "wt_ab12",
                name: "wiki-indexer",
                repoId: "chorus",
                branch: "cron/indexer",
                agent: "codex",
                status: "review",
            },
            // missing id -> dropped
            { name: "no-id-worktree", branch: "chore/x" },
        ],
    });

    it("parses a well-formed worktree into an IFleetSession, converting dates", () => {
        const sessions = mapOrcaSessions(validJson, now);
        expect(sessions).toHaveLength(2);
        const first = sessions[0];
        expect(first.id).toBe("wt_9f2a1b");
        expect(first.title).toBe("fix-oauth-refresh");
        expect(first.agent).toBe("claude-code");
        expect(first.branch).toBe("fix/oauth-refresh");
        expect(first.status).toBe("running");
        expect(first.machine).toBe("local");
        expect(first.progressPct).toBe(72);
        expect(first.createdAt).toBeInstanceOf(Date);
        expect(first.createdAt.toISOString()).toBe("2026-07-21T17:48:00.000Z");
        expect(first.featureId).toBe("orca-feature-chorus");
        expect(first.ticketId).toBe("wt_9f2a1b");
    });

    it("drops entries missing a required id instead of throwing", () => {
        const sessions = mapOrcaSessions(validJson, now);
        expect(sessions.find((s) => s.title === "no-id-worktree")).toBeUndefined();
    });

    it("falls back createdAt/updatedAt to 'now' when timestamps are absent", () => {
        const sessions = mapOrcaSessions(validJson, now);
        const second = sessions.find((s) => s.id === "wt_ab12")!;
        expect(second.createdAt).toEqual(now);
        expect(second.updatedAt).toEqual(now);
        expect(second.status).toBe("needs-review");
    });

    it("returns [] for malformed JSON", () => {
        expect(mapOrcaSessions("not json", now)).toEqual([]);
    });

    it("defaults agent to 'unknown' when absent", () => {
        const json = JSON.stringify({
            worktrees: [{ id: "wt_x", name: "no-agent" }],
        });
        const sessions = mapOrcaSessions(json, now);
        expect(sessions[0].agent).toBe("unknown");
    });
});

describe("mapOrcaMachines", () => {
    it("synthesizes a single 'local' machine with load = running-session count", () => {
        const sessions = mapOrcaSessions(
            JSON.stringify({
                worktrees: [
                    { id: "1", status: "running" },
                    { id: "2", status: "running" },
                    { id: "3", status: "queued" },
                ],
            }),
            now,
        );
        const machines = mapOrcaMachines(sessions, "my-mac");
        expect(machines).toEqual([
            {
                id: "local",
                name: "my-mac",
                status: "online",
                load: { current: 2, max: 4 },
            },
        ]);
    });

    it("raises max above the default cap when running count exceeds it", () => {
        const sessions = mapOrcaSessions(
            JSON.stringify({
                worktrees: [
                    { id: "1", status: "running" },
                    { id: "2", status: "running" },
                    { id: "3", status: "running" },
                    { id: "4", status: "running" },
                    { id: "5", status: "running" },
                ],
            }),
            now,
        );
        const machines = mapOrcaMachines(sessions);
        expect(machines[0].load).toEqual({ current: 5, max: 5 });
    });

    it("defaults the hostname to 'local' when none is provided", () => {
        const machines = mapOrcaMachines([]);
        expect(machines[0].name).toBe("local");
        expect(machines[0].load).toEqual({ current: 0, max: 4 });
    });
});

describe("mapOrcaFeatures", () => {
    it("groups sessions sharing a repoId into one feature with one ticket per session", () => {
        const sessions = mapOrcaSessions(
            JSON.stringify({
                worktrees: [
                    {
                        id: "wt_1",
                        name: "t1",
                        repoId: "chorus",
                        branch: "feat/a",
                        status: "running",
                        createdAt: "2026-07-20T18:00:00.000Z",
                        updatedAt: "2026-07-21T18:00:00.000Z",
                    },
                    {
                        id: "wt_2",
                        name: "t2",
                        repoId: "chorus",
                        branch: "feat/b",
                        status: "merged",
                        createdAt: "2026-07-19T18:00:00.000Z",
                        updatedAt: "2026-07-20T12:00:00.000Z",
                    },
                ],
            }),
            now,
        );
        const features = mapOrcaFeatures(sessions);
        expect(features).toHaveLength(1);
        const feature = features[0];
        expect(feature.id).toBe("orca-feature-chorus");
        expect(feature.title).toBe("chorus");
        expect(feature.status).toBe("building");
        expect(feature.tickets).toHaveLength(2);
        expect(feature.tickets.map((t) => t.id).sort()).toEqual(["wt_1", "wt_2"]);
        // earliest createdAt / latest updatedAt across the group
        expect(feature.createdAt.toISOString()).toBe("2026-07-19T18:00:00.000Z");
        expect(feature.updatedAt.toISOString()).toBe("2026-07-21T18:00:00.000Z");
        // ticket status mapping: running -> running, merged -> merged
        const t1 = feature.tickets.find((t) => t.id === "wt_1")!;
        const t2 = feature.tickets.find((t) => t.id === "wt_2")!;
        expect(t1.status).toBe("running");
        expect(t2.status).toBe("merged");
    });

    it("collapses sessions with no recoverable repoId into a single 'ungrouped' feature", () => {
        const sessions = mapOrcaSessions(
            JSON.stringify({
                worktrees: [
                    { id: "wt_1", name: "a", status: "running" },
                    { id: "wt_2", name: "b", status: "running" },
                ],
            }),
            now,
        );
        const features = mapOrcaFeatures(sessions);
        expect(features).toHaveLength(1);
        expect(features[0].title).toBe("Orca worktrees");
        expect(features[0].tickets).toHaveLength(2);
    });

    it("maps needs-review sessions to 'awaiting-merge' tickets", () => {
        const sessions = mapOrcaSessions(
            JSON.stringify({
                worktrees: [
                    { id: "wt_1", name: "a", repoId: "r", status: "review" },
                ],
            }),
            now,
        );
        const features = mapOrcaFeatures(sessions);
        expect(features[0].tickets[0].status).toBe("awaiting-merge");
    });

    it("returns [] for an empty session list", () => {
        expect(mapOrcaFeatures([])).toEqual([]);
    });
});

describe("mapOrcaLogLine", () => {
    it("extracts the last line's text from the assumed { lines: [...] } shape", () => {
        const json = JSON.stringify({
            lines: [
                { text: "▸ starting…" },
                { text: "▸ RefreshScheduler.test.ts 41/44" },
            ],
        });
        expect(mapOrcaLogLine(json)).toBe("▸ RefreshScheduler.test.ts 41/44");
    });

    it("returns undefined for malformed JSON", () => {
        expect(mapOrcaLogLine("not json")).toBeUndefined();
    });

    it("returns undefined when 'lines' is missing or not an array", () => {
        expect(mapOrcaLogLine(JSON.stringify({ output: "hi" }))).toBeUndefined();
    });

    it("returns undefined for an empty lines array", () => {
        expect(mapOrcaLogLine(JSON.stringify({ lines: [] }))).toBeUndefined();
    });
});
