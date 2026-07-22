import { describe, expect, it } from "vitest";
import { layoutFullGraph, layoutGraphByFolder, layoutLocalGraph } from "./graphLayout";

function expectFinitePosition(pos: { x: number; y: number }) {
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
}

describe("layoutLocalGraph", () => {
    it("places the focus node at the exact center", () => {
        const positions = layoutLocalGraph(["a", "focus", "b"], "focus", {
            width: 300,
            height: 200,
        });
        const focus = positions.find((p) => p.id === "focus");
        expect(focus).toEqual({ id: "focus", x: 150, y: 100 });
    });

    it("returns one position per node, with no duplicates", () => {
        const ids = ["focus", "a", "b", "c"];
        const positions = layoutLocalGraph(ids, "focus", { width: 300, height: 200 });
        expect(positions.map((p) => p.id).sort()).toEqual(ids.sort());
    });

    it("spaces neighbors evenly around the focus node (equal distance from center)", () => {
        const positions = layoutLocalGraph(["focus", "a", "b", "c", "d"], "focus", {
            width: 400,
            height: 400,
        });
        const center = { x: 200, y: 200 };
        const distances = positions
            .filter((p) => p.id !== "focus")
            .map((p) => Math.hypot(p.x - center.x, p.y - center.y));
        for (const d of distances) {
            expect(d).toBeCloseTo(distances[0], 5);
        }
    });

    it("handles a focus node with no neighbors", () => {
        const positions = layoutLocalGraph(["focus"], "focus", { width: 300, height: 200 });
        expect(positions).toEqual([{ id: "focus", x: 150, y: 100 }]);
    });

    it("is deterministic across calls", () => {
        const bounds = { width: 300, height: 200 };
        const first = layoutLocalGraph(["focus", "a", "b"], "focus", bounds);
        const second = layoutLocalGraph(["focus", "a", "b"], "focus", bounds);
        expect(first).toEqual(second);
    });

    it("never produces NaN/Infinity coordinates", () => {
        const positions = layoutLocalGraph(["focus", "a", "b", "c"], "focus", {
            width: 300,
            height: 200,
        });
        positions.forEach(expectFinitePosition);
    });
});

describe("layoutFullGraph", () => {
    it("returns a position for every node across every folder", () => {
        const byFolder = new Map([
            ["companies", ["NVIDIA.md", "TSMC.md"]],
            ["concepts", ["CUDA.md"]],
        ]);
        const positions = layoutFullGraph(byFolder, { width: 800, height: 600 });
        expect(positions.map((p) => p.id).sort()).toEqual(
            ["CUDA.md", "NVIDIA.md", "TSMC.md"].sort(),
        );
    });

    it("returns an empty layout for no folders", () => {
        expect(layoutFullGraph(new Map(), { width: 800, height: 600 })).toEqual([]);
    });

    it("never produces NaN/Infinity coordinates, including for a lone node", () => {
        const byFolder = new Map([["solo", ["only.md"]]]);
        const positions = layoutFullGraph(byFolder, { width: 800, height: 600 });
        positions.forEach(expectFinitePosition);
    });

    it("is deterministic across calls", () => {
        const byFolder = new Map([
            ["companies", ["a.md", "b.md"]],
            ["concepts", ["c.md"]],
        ]);
        const bounds = { width: 800, height: 600 };
        expect(layoutFullGraph(byFolder, bounds)).toEqual(layoutFullGraph(byFolder, bounds));
    });
});

describe("layoutGraphByFolder", () => {
    it("groups nodes by folder before delegating to layoutFullGraph", () => {
        const nodes = [
            { id: "companies/NVIDIA.md", folder: "companies" },
            { id: "concepts/CUDA.md", folder: "concepts" },
            { id: "companies/TSMC.md", folder: "companies" },
        ];
        const positions = layoutGraphByFolder(nodes, { width: 800, height: 600 });
        expect(positions.map((p) => p.id).sort()).toEqual(
            nodes.map((n) => n.id).sort(),
        );
    });

    it("handles an empty node list", () => {
        expect(layoutGraphByFolder([], { width: 800, height: 600 })).toEqual([]);
    });
});
