import { describe, expect, it } from "vitest";
import { buildVaultTree } from "./vaultTree";
import type { IVaultTreeFolder } from "./types";

describe("buildVaultTree", () => {
    it("nests files under their folders", () => {
        const tree = buildVaultTree(
            ["companies/NVIDIA.md", "companies/TSMC.md", "root-note.md"],
            new Map(),
        );

        expect(tree).toHaveLength(2); // "companies" folder + root-note.md file
        const companies = tree[0] as IVaultTreeFolder;
        expect(companies.kind).toBe("folder");
        expect(companies.name).toBe("companies");
        expect(companies.path).toBe("companies");
        expect(companies.children.map((c) => c.name)).toEqual(["NVIDIA.md", "TSMC.md"]);

        expect(tree[1]).toMatchObject({ kind: "file", name: "root-note.md" });
    });

    it("sorts folders before files, both alphabetically", () => {
        const tree = buildVaultTree(
            ["zebra.md", "concepts/x.md", "apple.md", "companies/y.md"],
            new Map(),
        );
        expect(tree.map((n) => n.name)).toEqual(["companies", "concepts", "apple.md", "zebra.md"]);
    });

    it("supports nested subfolders (e.g. sources/questions)", () => {
        const tree = buildVaultTree(
            ["sources/nvda-10q.md", "sources/questions/amd-catchup.md"],
            new Map(),
        );
        const sources = tree[0] as IVaultTreeFolder;
        expect(sources.path).toBe("sources");
        const questions = sources.children.find((c) => c.kind === "folder") as IVaultTreeFolder;
        expect(questions.path).toBe("sources/questions");
        expect(questions.children).toEqual([
            { kind: "file", name: "amd-catchup.md", path: "sources/questions/amd-catchup.md", linkCount: undefined },
        ]);
    });

    it("a folder's fileCount is the total number of files nested under it, recursively", () => {
        const tree = buildVaultTree(
            ["sources/a.md", "sources/questions/b.md", "sources/questions/c.md"],
            new Map(),
        );
        const sources = tree[0] as IVaultTreeFolder;
        expect(sources.fileCount).toBe(3);
        const questions = sources.children.find((c) => c.kind === "folder") as IVaultTreeFolder;
        expect(questions.fileCount).toBe(2);
    });

    it("attaches a file's backlink count from the provided map, leaving unindexed files undefined", () => {
        const linkCounts = new Map([["companies/NVIDIA.md", 22]]);
        const tree = buildVaultTree(["companies/NVIDIA.md", "companies/TSMC.md"], linkCounts);
        const companies = tree[0] as IVaultTreeFolder;
        expect(companies.children).toEqual([
            { kind: "file", name: "NVIDIA.md", path: "companies/NVIDIA.md", linkCount: 22 },
            { kind: "file", name: "TSMC.md", path: "companies/TSMC.md", linkCount: undefined },
        ]);
    });

    it("returns an empty tree for an empty vault", () => {
        expect(buildVaultTree([], new Map())).toEqual([]);
    });
});
