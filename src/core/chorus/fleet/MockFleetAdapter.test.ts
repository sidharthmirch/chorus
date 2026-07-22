import { describe, expect, it } from "vitest";
import { MockFleetAdapter } from "./MockFleetAdapter";
import { FleetEvent } from "./protocol";

const now = new Date(2026, 6, 21, 18, 0, 0);

describe("MockFleetAdapter", () => {
    it("is always 'connected' — it's the default, no-daemon-needed adapter", () => {
        const adapter = new MockFleetAdapter(now);
        expect(adapter.getConnectionState()).toBe("connected");
    });

    it("seeds the exact fixture counts: 3 machines, 7 sessions, 2 features, 3 cost presets", async () => {
        const adapter = new MockFleetAdapter(now);
        await expect(adapter.listMachines()).resolves.toHaveLength(3);
        await expect(adapter.listSessions()).resolves.toHaveLength(7);
        await expect(adapter.listFeatures()).resolves.toHaveLength(2);
        await expect(adapter.listCostPresets()).resolves.toHaveLength(3);
    });

    it("groups sessions into the 4 kanban statuses exactly as the design fixture specifies (2/2/1/2)", async () => {
        const adapter = new MockFleetAdapter(now);
        const sessions = await adapter.listSessions();
        const counts = { queued: 0, running: 0, "needs-review": 0, merged: 0 };
        for (const session of sessions) counts[session.status]++;
        expect(counts).toEqual({
            queued: 2,
            running: 2,
            "needs-review": 1,
            merged: 2,
        });
    });

    it("calls a new subscriber immediately with connection + sessions + machines + features snapshots", () => {
        const adapter = new MockFleetAdapter(now);
        const events: FleetEvent["type"][] = [];
        const unsubscribe = adapter.subscribe((event) => events.push(event.type));
        expect(events).toEqual(["connection", "sessions", "machines", "features"]);
        unsubscribe();
    });

    it("dispatchSession moves a queued session to running on the given machine", async () => {
        const adapter = new MockFleetAdapter(now);
        const before = await adapter.listSessions();
        const queued = before.find((s) => s.status === "queued");
        expect(queued).toBeDefined();

        await adapter.dispatchSession(queued!.id, "gpu-box");

        const after = await adapter.listSessions();
        const updated = after.find((s) => s.id === queued!.id);
        expect(updated?.status).toBe("running");
        expect(updated?.machine).toBe("gpu-box");
        expect(updated?.progressPct).toBe(0);
    });

    it("dispatchSession is a no-op for a session that isn't queued", async () => {
        const adapter = new MockFleetAdapter(now);
        const before = await adapter.listSessions();
        const running = before.find((s) => s.status === "running");
        expect(running).toBeDefined();

        await adapter.dispatchSession(running!.id, "gpu-box");

        const after = await adapter.listSessions();
        expect(after.find((s) => s.id === running!.id)).toEqual(running);
    });

    it("pauseSession/resumeSession toggle the paused flag on a running session and notify subscribers", async () => {
        const adapter = new MockFleetAdapter(now);
        const sessions = await adapter.listSessions();
        const running = sessions.find((s) => s.status === "running")!;

        let latestSessions = sessions;
        adapter.subscribe((event) => {
            if (event.type === "sessions") latestSessions = event.sessions;
        });

        await adapter.pauseSession(running.id);
        expect(latestSessions.find((s) => s.id === running.id)?.paused).toBe(true);

        await adapter.resumeSession(running.id);
        expect(latestSessions.find((s) => s.id === running.id)?.paused).toBe(false);
    });

    it("pauseSession is a no-op for a session that isn't running", async () => {
        const adapter = new MockFleetAdapter(now);
        const sessions = await adapter.listSessions();
        const queued = sessions.find((s) => s.status === "queued")!;

        await adapter.pauseSession(queued.id);

        const after = await adapter.listSessions();
        expect(after.find((s) => s.id === queued.id)?.paused).toBeUndefined();
    });

    it("stops notifying a listener once it unsubscribes", async () => {
        const adapter = new MockFleetAdapter(now);
        const sessions = await adapter.listSessions();
        const queued = sessions.find((s) => s.status === "queued")!;

        let callCount = 0;
        const unsubscribe = adapter.subscribe(() => {
            callCount++;
        });
        const countAfterSubscribe = callCount;
        unsubscribe();

        await adapter.dispatchSession(queued.id, "m4-mini");

        expect(callCount).toBe(countAfterSubscribe);
    });
});
