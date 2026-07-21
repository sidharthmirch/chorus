import { describe, expect, it } from "vitest";
import {
    computeBacklinkCounts,
    getBacklinkEdgesFor,
    getOutlinkEdgesFor,
    resolveAllLinks,
    type IIndexedFileForGraph,
} from "./linkGraph";
import type { IWikilinkMatch } from "./types";

function link(target: string, overrides: Partial<IWikilinkMatch> = {}): IWikilinkMatch {
    return { raw: `[[${target}]]`, target, isEmbed: false, start: 0, end: 0, ...overrides };
}

describe("resolveAllLinks", () => {
    const files: IIndexedFileForGraph[] = [
        { path: "companies/NVIDIA.md", title: "NVIDIA", links: [link("TSMC"), link("CUDA")] },
        { path: "companies/TSMC.md", title: "TSMC", links: [link("NVIDIA")] },
        { path: "concepts/CUDA.md", title: "CUDA", links: [] },
    ];

    it("resolves mentions to real paths", () => {
        const edges = resolveAllLinks(files);
        expect(edges).toEqual([
            { source: "companies/NVIDIA.md", target: "companies/TSMC.md", link: link("TSMC") },
            { source: "companies/NVIDIA.md", target: "concepts/CUDA.md", link: link("CUDA") },
            { source: "companies/TSMC.md", target: "companies/NVIDIA.md", link: link("NVIDIA") },
        ]);
    });

    it("drops mentions that don't resolve to any known file", () => {
        const withOrphan: IIndexedFileForGraph[] = [
            { path: "companies/NVIDIA.md", title: "NVIDIA", links: [link("mixture-of-experts")] },
        ];
        expect(resolveAllLinks(withOrphan)).toEqual([]);
    });

    it("drops self-links", () => {
        const selfLinking: IIndexedFileForGraph[] = [
            { path: "companies/NVIDIA.md", title: "NVIDIA", links: [link("NVIDIA")] },
        ];
        expect(resolveAllLinks(selfLinking)).toEqual([]);
    });
});

describe("computeBacklinkCounts / getBacklinkEdgesFor / getOutlinkEdgesFor", () => {
    const files: IIndexedFileForGraph[] = [
        { path: "a.md", title: "a", links: [link("b"), link("b"), link("c")] },
        { path: "b.md", title: "b", links: [link("c")] },
        { path: "c.md", title: "c", links: [] },
    ];
    const edges = resolveAllLinks(files);

    it("counts backlinks per target, including duplicate mentions from the same source", () => {
        const counts = computeBacklinkCounts(edges);
        expect(counts.get("b.md")).toBe(2);
        expect(counts.get("c.md")).toBe(2);
        expect(counts.get("a.md")).toBeUndefined();
    });

    it("getBacklinkEdgesFor returns only edges pointing at the target", () => {
        expect(getBacklinkEdgesFor(edges, "c.md")).toHaveLength(2);
        expect(getBacklinkEdgesFor(edges, "c.md").every((e) => e.target === "c.md")).toBe(true);
    });

    it("getOutlinkEdgesFor returns only edges leaving the source", () => {
        const outlinks = getOutlinkEdgesFor(edges, "a.md");
        expect(outlinks).toHaveLength(3);
        expect(outlinks.every((e) => e.source === "a.md")).toBe(true);
    });
});
