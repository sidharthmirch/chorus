import { describe, expect, it } from "vitest";
import {
    extractHeadings,
    extractWikilinks,
    folderOfPath,
    getBlockSeparatorRanges,
    getImmuneRanges,
    noteTitle,
    parseFrontmatter,
    parseNote,
    resolveWikilinkTarget,
    titleFromPath,
    topFolderOfPath,
} from "./parse";

describe("parseFrontmatter", () => {
    it("parses YAML frontmatter and strips it from the body", () => {
        const raw = [
            "---",
            "type: company",
            "tags: [semiconductors, networking]",
            "mcap: $4.6T",
            "---",
            "",
            "NVIDIA Corp is a fabless GPU designer.",
        ].join("\n");

        const { frontmatter, body } = parseFrontmatter(raw);
        expect(frontmatter).toEqual({
            type: "company",
            tags: ["semiconductors", "networking"],
            mcap: "$4.6T",
        });
        expect(body.trim()).toBe("NVIDIA Corp is a fabless GPU designer.");
    });

    it("returns an empty frontmatter object when there is none", () => {
        const { frontmatter, body } = parseFrontmatter("just a plain note body");
        expect(frontmatter).toEqual({});
        expect(body).toBe("just a plain note body");
    });

    it("never throws on an empty file", () => {
        const { frontmatter, body } = parseFrontmatter("");
        expect(frontmatter).toEqual({});
        expect(body).toBe("");
    });
});

describe("extractWikilinks", () => {
    it("extracts a bare wikilink", () => {
        const matches = extractWikilinks("See [[CUDA]] for details.");
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
            raw: "[[CUDA]]",
            target: "CUDA",
            alias: undefined,
            isEmbed: false,
        });
        expect(matches[0].start).toBe(4);
        expect(matches[0].end).toBe(12);
    });

    it("extracts an aliased wikilink [[target|alias]]", () => {
        const matches = extractWikilinks("The [[Blackwell architecture|Blackwell]] chip.");
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
            target: "Blackwell architecture",
            alias: "Blackwell",
            isEmbed: false,
        });
    });

    it("extracts an embed ![[target]] and flags isEmbed", () => {
        const matches = extractWikilinks("![[nvda-10q-2026.pdf]]");
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
            target: "nvda-10q-2026.pdf",
            isEmbed: true,
        });
    });

    it("extracts an aliased embed ![[target|alias]]", () => {
        const matches = extractWikilinks("![[quarterly-chart|Q2 chart]]");
        expect(matches[0]).toMatchObject({
            target: "quarterly-chart",
            alias: "Q2 chart",
            isEmbed: true,
        });
    });

    it("extracts multiple links from one line, in order, with correct offsets", () => {
        const text = "[[CUDA]] and [[Blackwell architecture]] and [[kv-cache]]";
        const matches = extractWikilinks(text);
        expect(matches.map((m) => m.target)).toEqual([
            "CUDA",
            "Blackwell architecture",
            "kv-cache",
        ]);
        for (const m of matches) {
            expect(text.slice(m.start, m.end)).toBe(m.raw);
        }
    });

    it("trims whitespace inside the brackets", () => {
        const matches = extractWikilinks("[[  CUDA  |  the CUDA runtime  ]]");
        expect(matches[0].target).toBe("CUDA");
        expect(matches[0].alias).toBe("the CUDA runtime");
    });

    it("does not match a lone single-bracket pair", () => {
        expect(extractWikilinks("this is [not a link] at all")).toHaveLength(0);
    });

    it("does not match across a newline", () => {
        expect(extractWikilinks("[[broken\nlink]]")).toHaveLength(0);
    });

    it("ignores degenerate [[]] / [[|alias]] mentions", () => {
        expect(extractWikilinks("[[]]")).toHaveLength(0);
        expect(extractWikilinks("[[|alias only]]")).toHaveLength(0);
    });

    describe("code-fence immunity", () => {
        it("does not extract a wikilink-looking string inside a fenced code block", () => {
            const text = [
                "Some prose with [[real link]].",
                "```",
                "This mentions [[CUDA]] but it's just an example.",
                "```",
                "More prose with [[another real link]].",
            ].join("\n");
            const matches = extractWikilinks(text);
            expect(matches.map((m) => m.target)).toEqual(["real link", "another real link"]);
        });

        it("does not extract a wikilink-looking string inside inline code", () => {
            const matches = extractWikilinks(
                "Use `[[target]]` syntax to link, e.g. [[CUDA]].",
            );
            expect(matches).toHaveLength(1);
            expect(matches[0].target).toBe("CUDA");
        });

        it("handles a fenced block using ~~~ delimiters", () => {
            const text = ["~~~", "[[not a link]]", "~~~", "[[a real link]]"].join("\n");
            const matches = extractWikilinks(text);
            expect(matches.map((m) => m.target)).toEqual(["a real link"]);
        });

        it("requires the closing fence to match the opener's character and length", () => {
            // A 4-backtick fence is only closed by another run of >= 4 backticks;
            // a plain 3-backtick line here is still "inside" the block.
            const text = ["````", "[[still inside]]", "```", "[[also still inside]]", "````", "[[outside]]"].join(
                "\n",
            );
            const matches = extractWikilinks(text);
            expect(matches.map((m) => m.target)).toEqual(["outside"]);
        });
    });
});

describe("extractHeadings", () => {
    it("extracts ATX headings with their level", () => {
        const text = ["# Title", "## Section one", "###### deep heading", "not a heading"].join(
            "\n",
        );
        expect(extractHeadings(text)).toEqual([
            { level: 1, text: "Title" },
            { level: 2, text: "Section one" },
            { level: 6, text: "deep heading" },
        ]);
    });

    it("does not treat a fenced comment line starting with # as a heading", () => {
        const text = ["```bash", "# this is a shell comment, not a heading", "```", "# real heading"].join(
            "\n",
        );
        expect(extractHeadings(text)).toEqual([{ level: 1, text: "real heading" }]);
    });

    it("requires a space after the hashes (not a hashtag)", () => {
        expect(extractHeadings("#nospace")).toEqual([]);
    });
});

describe("getImmuneRanges", () => {
    it("covers the full fenced block including its fence markers", () => {
        const text = ["a", "```", "b", "```", "c"].join("\n");
        const ranges = getImmuneRanges(text);
        // lines: "a"(0-1) "```"(2-5) "b"(6-7) "```"(8-11) "c"(12-13)
        expect(ranges).toEqual([
            [2, 5],
            [6, 7],
            [8, 11],
        ]);
    });
});

describe("getBlockSeparatorRanges", () => {
    it("finds a simple blank-line separator between two paragraphs", () => {
        const text = "Intro.\n\nOutro.";
        expect(getBlockSeparatorRanges(text)).toEqual([[6, 8]]);
    });

    it("excludes a blank line that falls inside a fenced code block", () => {
        const before = "Intro.";
        const fenced = "```\nline one\n\nline two (blank line above, still fenced)\n```";
        const after = "Outro.";
        const text = `${before}\n\n${fenced}\n\n${after}`;

        const firstGapStart = before.length;
        const firstGapEnd = firstGapStart + 2;
        const secondGapStart = firstGapEnd + fenced.length;
        const secondGapEnd = secondGapStart + 2;

        // exactly the separator before and after the fence -- NOT the blank
        // line inside `fenced`, between "line one" and "line two"
        expect(getBlockSeparatorRanges(text)).toEqual([
            [firstGapStart, firstGapEnd],
            [secondGapStart, secondGapEnd],
        ]);
        // sanity: slicing at these ranges reconstructs each block cleanly,
        // with the fence's internal blank line preserved intact
        expect(text.slice(0, firstGapStart)).toBe(before);
        expect(text.slice(firstGapEnd, secondGapStart)).toBe(fenced);
        expect(text.slice(secondGapEnd)).toBe(after);
    });

    it("treats a gap right after a closing fence as a real separator", () => {
        const text = "```\ncode\n```\n\nAfter the fence.";
        const ranges = getBlockSeparatorRanges(text);
        expect(ranges).toEqual([[12, 14]]);
    });

    it("returns no separators for a single block with no blank lines", () => {
        expect(getBlockSeparatorRanges("just one paragraph, no gaps")).toEqual([]);
    });
});

describe("parseNote", () => {
    it("combines frontmatter, wikilinks, and headings from a realistic note", () => {
        const raw = [
            "---",
            "type: company",
            "sector: semiconductors",
            "---",
            "# NVIDIA",
            "",
            "NVIDIA Corp — fabless GPU designer. Depends on [[TSMC]] for [[CoWoS packaging|CoWoS]].",
        ].join("\n");

        const parsed = parseNote(raw);
        expect(parsed.frontmatter).toEqual({ type: "company", sector: "semiconductors" });
        expect(parsed.headings).toEqual([{ level: 1, text: "NVIDIA" }]);
        expect(parsed.links.map((l) => l.target)).toEqual(["TSMC", "CoWoS packaging"]);
    });
});

describe("path helpers", () => {
    it("folderOfPath returns everything but the last segment", () => {
        expect(folderOfPath("companies/NVIDIA.md")).toBe("companies");
        expect(folderOfPath("sources/questions/amd-catchup.md")).toBe("sources/questions");
        expect(folderOfPath("root-note.md")).toBe("");
    });

    it("topFolderOfPath returns only the first segment", () => {
        expect(topFolderOfPath("sources/questions/amd-catchup.md")).toBe("sources");
        expect(topFolderOfPath("root-note.md")).toBe("");
    });

    it("titleFromPath strips the directory and extension", () => {
        expect(titleFromPath("companies/NVIDIA.md")).toBe("NVIDIA");
        expect(titleFromPath("NVIDIA.md")).toBe("NVIDIA");
    });

    it("noteTitle prefers an explicit frontmatter title", () => {
        expect(noteTitle("companies/NVIDIA.md", { title: "NVIDIA Corporation" })).toBe(
            "NVIDIA Corporation",
        );
        expect(noteTitle("companies/NVIDIA.md", {})).toBe("NVIDIA");
    });
});

describe("resolveWikilinkTarget", () => {
    const files = [
        { path: "companies/NVIDIA.md", title: "NVIDIA" },
        { path: "concepts/CUDA.md", title: "CUDA" },
        { path: "concepts/Blackwell architecture.md", title: "Blackwell architecture" },
    ];

    it("resolves an exact path (extension optional)", () => {
        expect(resolveWikilinkTarget("concepts/CUDA", files)).toBe("concepts/CUDA.md");
        expect(resolveWikilinkTarget("concepts/CUDA.md", files)).toBe("concepts/CUDA.md");
    });

    it("resolves a bare basename regardless of folder", () => {
        expect(resolveWikilinkTarget("CUDA", files)).toBe("concepts/CUDA.md");
    });

    it("is case-insensitive", () => {
        expect(resolveWikilinkTarget("nvidia", files)).toBe("companies/NVIDIA.md");
    });

    it("resolves an aliased target's underlying name, not the alias", () => {
        expect(resolveWikilinkTarget("Blackwell architecture", files)).toBe(
            "concepts/Blackwell architecture.md",
        );
    });

    it("returns undefined for a mention with no matching note", () => {
        expect(resolveWikilinkTarget("mixture-of-experts", files)).toBeUndefined();
    });
});
