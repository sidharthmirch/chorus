import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrcaCliAdapter } from "./OrcaCliAdapter";
import { OrcaCommandResult } from "./orcaCommand";
import { FleetEvent } from "./protocol";

function psResult(stdout: string, exitCode = 0): OrcaCommandResult {
    return { stdout, exitCode };
}

const oneRunningWorktreeJson = JSON.stringify({
    worktrees: [
        {
            id: "wt_1",
            name: "fix-oauth-refresh",
            repoId: "chorus",
            branch: "fix/oauth-refresh",
            agent: "claude-code",
            status: "running",
            progressPct: 40,
        },
    ],
});

describe("OrcaCliAdapter.getConnectionState", () => {
    it("starts 'connecting' before any command has run", () => {
        const adapter = new OrcaCliAdapter(vi.fn());
        expect(adapter.getConnectionState()).toBe("connecting");
    });
});

describe("OrcaCliAdapter binary-missing / error path", () => {
    it("reports 'not-configured' and empty lists when the runner throws (e.g. ENOENT)", async () => {
        const runner = vi.fn().mockRejectedValue(new Error("ENOENT: orca not found"));
        const adapter = new OrcaCliAdapter(runner);

        await expect(adapter.listSessions()).resolves.toEqual([]);
        expect(adapter.getConnectionState()).toBe("not-configured");
        await expect(adapter.listMachines()).resolves.toEqual([]);
        await expect(adapter.listFeatures()).resolves.toEqual([]);
    });

    it("reports 'not-configured' when the command exits non-zero", async () => {
        const runner = vi.fn().mockResolvedValue(psResult("", 1));
        const adapter = new OrcaCliAdapter(runner);

        await expect(adapter.listSessions()).resolves.toEqual([]);
        expect(adapter.getConnectionState()).toBe("not-configured");
    });

    it("never throws out of list* even when the runner rejects", async () => {
        const runner = vi.fn().mockRejectedValue(new Error("boom"));
        const adapter = new OrcaCliAdapter(runner);
        await expect(adapter.listSessions()).resolves.toEqual([]);
        await expect(adapter.listMachines()).resolves.toEqual([]);
        await expect(adapter.listFeatures()).resolves.toEqual([]);
    });
});

describe("OrcaCliAdapter happy path", () => {
    it("lists sessions parsed from a successful 'orca worktree ps --json' call and reports 'connected'", async () => {
        const runner = vi.fn().mockResolvedValue(psResult(oneRunningWorktreeJson));
        const adapter = new OrcaCliAdapter(runner);

        const sessions = await adapter.listSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe("wt_1");
        expect(sessions[0].status).toBe("running");
        expect(adapter.getConnectionState()).toBe("connected");
        expect(runner).toHaveBeenCalledWith(["worktree", "ps", "--json"]);
    });

    it("lists a single synthesized 'local' machine reflecting the running-session count", async () => {
        const runner = vi.fn().mockResolvedValue(psResult(oneRunningWorktreeJson));
        const adapter = new OrcaCliAdapter(runner);

        const machines = await adapter.listMachines();
        expect(machines).toHaveLength(1);
        expect(machines[0].id).toBe("local");
        expect(machines[0].load.current).toBe(1);
    });

    it("lists features grouped by repo id", async () => {
        const runner = vi.fn().mockResolvedValue(psResult(oneRunningWorktreeJson));
        const adapter = new OrcaCliAdapter(runner);

        const features = await adapter.listFeatures();
        expect(features).toHaveLength(1);
        expect(features[0].tickets).toHaveLength(1);
        expect(features[0].tickets[0].sessionId).toBe("wt_1");
    });

    it("always returns an empty cost-preset list — orca has no cost-preset concept", async () => {
        const runner = vi.fn().mockResolvedValue(psResult(oneRunningWorktreeJson));
        const adapter = new OrcaCliAdapter(runner);
        await expect(adapter.listCostPresets()).resolves.toEqual([]);
    });
});

describe("OrcaCliAdapter mutations — none are supported in v1", () => {
    it("dispatchSession throws a clear, descriptive error instead of faking success", async () => {
        const adapter = new OrcaCliAdapter(vi.fn());
        await expect(adapter.dispatchSession("s1", "m1")).rejects.toThrow(
            /isn't supported by the orca backend/,
        );
    });

    it("pauseSession throws a clear, descriptive error instead of faking success", async () => {
        const adapter = new OrcaCliAdapter(vi.fn());
        await expect(adapter.pauseSession("s1")).rejects.toThrow(
            /isn't supported by the orca backend/,
        );
    });

    it("resumeSession throws a clear, descriptive error instead of faking success", async () => {
        const adapter = new OrcaCliAdapter(vi.fn());
        await expect(adapter.resumeSession("s1")).rejects.toThrow(
            /isn't supported by the orca backend/,
        );
    });
});

describe("OrcaCliAdapter.subscribe", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("calls a new subscriber immediately with connection + sessions + machines + features snapshots", async () => {
        const runner = vi.fn().mockResolvedValue(psResult(oneRunningWorktreeJson));
        const adapter = new OrcaCliAdapter(runner);

        const events: FleetEvent["type"][] = [];
        adapter.subscribe((event) => events.push(event.type));

        // Flush the microtask queue for the immediate async refresh
        // `start()` kicks off, without advancing far enough (5000ms) to
        // also fire the poll interval itself.
        await vi.advanceTimersByTimeAsync(0);

        expect(events).toEqual(["connection", "connection", "sessions", "machines", "features"]);
    });

    it("polls again after the interval elapses", async () => {
        const runner = vi.fn().mockResolvedValue(psResult(oneRunningWorktreeJson));
        const adapter = new OrcaCliAdapter(runner);

        adapter.subscribe(() => {});
        await vi.advanceTimersByTimeAsync(0);
        expect(runner).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(5000);
        expect(runner).toHaveBeenCalledTimes(2);
    });

    it("stops polling once unsubscribed", async () => {
        const runner = vi.fn().mockResolvedValue(psResult(oneRunningWorktreeJson));
        const adapter = new OrcaCliAdapter(runner);

        const unsubscribe = adapter.subscribe(() => {});
        await vi.advanceTimersByTimeAsync(0);
        const callsBeforeUnsubscribe = runner.mock.calls.length;

        unsubscribe();
        await vi.advanceTimersByTimeAsync(20000);

        expect(runner.mock.calls.length).toBe(callsBeforeUnsubscribe);
    });

    it("emits an empty machines/features snapshot (not just empty sessions) when the binary is missing", async () => {
        const runner = vi.fn().mockRejectedValue(new Error("ENOENT"));
        const adapter = new OrcaCliAdapter(runner);

        const events: FleetEvent[] = [];
        adapter.subscribe((event) => events.push(event));
        await vi.advanceTimersByTimeAsync(0);

        const machinesEvent = events.find((e) => e.type === "machines");
        const featuresEvent = events.find((e) => e.type === "features");
        expect(machinesEvent).toEqual({ type: "machines", machines: [] });
        expect(featuresEvent).toEqual({ type: "features", features: [] });
        expect(adapter.getConnectionState()).toBe("not-configured");
    });
});
