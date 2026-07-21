import { describe, expect, it, vi } from "vitest";
import { FleetdAdapter } from "./FleetdAdapter";

// Test-only stub covering just the subset of Response the adapter reads
// (ok/status/json()) — same convention as accounts/nineRouterClient.test.ts's
// `jsonResponse` helper.
function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

const ENDPOINT = "http://localhost:9000";

describe("FleetdAdapter connection state", () => {
    it("starts 'not-configured' with no endpoint", () => {
        const adapter = new FleetdAdapter(undefined, vi.fn());
        expect(adapter.getConnectionState()).toBe("not-configured");
    });

    it("starts 'connecting' once an endpoint is provided", () => {
        const adapter = new FleetdAdapter(ENDPOINT, vi.fn());
        expect(adapter.getConnectionState()).toBe("connecting");
    });
});

describe("FleetdAdapter.listSessions", () => {
    const validSession = {
        id: "s1",
        title: "fix: oauth token refresh",
        agent: "claude-code",
        machine: "m4-mini",
        branch: "fix/oauth-refresh",
        status: "running",
        createdAt: "2026-07-21T17:48:00.000Z",
        updatedAt: "2026-07-21T18:00:00.000Z",
        progressPct: 72,
        costUsd: 0.84,
    };

    it("parses a well-formed session, converting date strings to Dates", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ sessions: [validSession] }));
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        const sessions = await adapter.listSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe("s1");
        expect(sessions[0].createdAt).toBeInstanceOf(Date);
        expect(sessions[0].createdAt.toISOString()).toBe(
            "2026-07-21T17:48:00.000Z",
        );
        expect(sessions[0].progressPct).toBe(72);
    });

    it("drops entries missing a required field instead of throwing", async () => {
        const missingBranch = { ...validSession, branch: undefined };
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({ sessions: [validSession, missingBranch] }),
        );
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        const sessions = await adapter.listSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe("s1");
    });

    it("drops entries with an unrecognized status", async () => {
        const futureStatus = { ...validSession, id: "s2", status: "archived" };
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({ sessions: [validSession, futureStatus] }),
        );
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        const sessions = await adapter.listSessions();
        expect(sessions.map((s) => s.id)).toEqual(["s1"]);
    });

    it("returns an empty array (not a throw) when the request fails", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        await expect(adapter.listSessions()).resolves.toEqual([]);
    });

    it("returns an empty array on a non-2xx response", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        await expect(adapter.listSessions()).resolves.toEqual([]);
    });

    it("returns an empty array when there is no endpoint configured, without calling fetch", async () => {
        const fetchImpl = vi.fn();
        const adapter = new FleetdAdapter(undefined, fetchImpl);
        await expect(adapter.listSessions()).resolves.toEqual([]);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe("FleetdAdapter.listMachines / listFeatures / listCostPresets", () => {
    it("parses a well-formed machine", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                machines: [
                    { id: "m4-mini", name: "m4-mini", status: "online", load: { current: 2, max: 2 } },
                ],
            }),
        );
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        const machines = await adapter.listMachines();
        expect(machines).toEqual([
            { id: "m4-mini", name: "m4-mini", status: "online", load: { current: 2, max: 2 } },
        ]);
    });

    it("parses a well-formed feature including nested tickets and supervisor", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                features: [
                    {
                        id: "feat-1",
                        branch: "feat/agents-dash",
                        title: "Fleet dashboard",
                        worktreePath: "~/fleet/wt/agents-dash",
                        status: "building",
                        createdAt: "2026-07-20T18:00:00.000Z",
                        updatedAt: "2026-07-21T18:00:00.000Z",
                        supervisor: { state: "idle", note: "spawns when T-103 lands" },
                        tickets: [
                            {
                                id: "T-101",
                                title: "Sessions socket client",
                                worktreePath: "wt/agents-dash/t101",
                                status: "merged",
                                createdAt: "2026-07-20T18:00:00.000Z",
                                updatedAt: "2026-07-20T18:00:00.000Z",
                            },
                        ],
                    },
                ],
            }),
        );
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        const features = await adapter.listFeatures();
        expect(features).toHaveLength(1);
        expect(features[0].supervisor).toEqual({
            state: "idle",
            note: "spawns when T-103 lands",
        });
        expect(features[0].tickets).toHaveLength(1);
        expect(features[0].tickets[0].id).toBe("T-101");
    });

    it("parses a well-formed cost preset", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                presets: [
                    {
                        id: "balanced",
                        name: "Balanced",
                        estimateText: "est $1.50–3.00 per feature",
                        roles: {
                            planner: { agent: "claude-code", modelLabel: "Sonnet 4.5" },
                            worker: { agent: "claude-code", modelLabel: "Sonnet 4.5" },
                            supervisor: { agent: "claude-code", modelLabel: "Opus 4.5" },
                        },
                    },
                ],
            }),
        );
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        const presets = await adapter.listCostPresets();
        expect(presets).toHaveLength(1);
        expect(presets[0].roles.supervisor).toEqual({
            agent: "claude-code",
            modelLabel: "Opus 4.5",
        });
    });
});

describe("FleetdAdapter dispatch/pause/resume", () => {
    it("dispatchSession POSTs to /sessions/:id/dispatch with the machine id", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        await adapter.dispatchSession("s1", "m4-mini");
        expect(fetchImpl).toHaveBeenCalledWith(
            `${ENDPOINT}/sessions/s1/dispatch`,
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ machineId: "m4-mini" }),
            }),
        );
    });

    it("pauseSession PATCHes /sessions/:id with paused:true", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        await adapter.pauseSession("s1");
        expect(fetchImpl).toHaveBeenCalledWith(
            `${ENDPOINT}/sessions/s1`,
            expect.objectContaining({
                method: "PATCH",
                body: JSON.stringify({ paused: true }),
            }),
        );
    });

    it("throws instead of silently failing when the endpoint isn't configured", async () => {
        const adapter = new FleetdAdapter(undefined, vi.fn());
        await expect(adapter.dispatchSession("s1", "m4-mini")).rejects.toThrow();
    });

    it("throws when fleetd responds with a non-2xx status", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
        const adapter = new FleetdAdapter(ENDPOINT, fetchImpl);
        await expect(adapter.pauseSession("s1")).rejects.toThrow();
    });
});

describe("FleetdAdapter.subscribe with no endpoint configured", () => {
    it("immediately reports 'not-configured' and unsubscribes cleanly", () => {
        const adapter = new FleetdAdapter(undefined, vi.fn());
        const events: string[] = [];
        const unsubscribe = adapter.subscribe((event) => {
            if (event.type === "connection") events.push(event.state);
        });
        expect(events).toEqual(["not-configured"]);
        expect(() => unsubscribe()).not.toThrow();
    });
});
