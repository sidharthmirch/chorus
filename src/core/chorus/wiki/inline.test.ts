import { describe, expect, it } from "vitest";
import { extractWikilinks } from "./parse";
import {
    splitNoteBodyIntoBlocks,
    tokenizeBlockWithLinks,
    tokenizeFormatting,
    tokenizeInlineLine,
    type ILinkedBlock,
} from "./inline";

describe("tokenizeFormatting", () => {
    it("splits plain text with no formatting into one text token", () => {
        expect(tokenizeFormatting("just plain text")).toEqual([
            { kind: "text", value: "just plain text" },
        ]);
    });

    it("tokenizes bold, italic, and inline code interleaved with plain text", () => {
        expect(tokenizeFormatting("a **bold** b *italic* c `code` d")).toEqual([
            { kind: "text", value: "a " },
            { kind: "bold", value: "bold" },
            { kind: "text", value: " b " },
            { kind: "italic", value: "italic" },
            { kind: "text", value: " c " },
            { kind: "code", value: "code" },
            { kind: "text", value: " d" },
        ]);
    });

    it("supports underscore italics", () => {
        expect(tokenizeFormatting("_italic_")).toEqual([{ kind: "italic", value: "italic" }]);
    });

    it("returns an empty array for empty input", () => {
        expect(tokenizeFormatting("")).toEqual([]);
    });
});

describe("tokenizeInlineLine", () => {
    it("interleaves wikilink tokens with formatted text at the right positions", () => {
        const line = "See [[CUDA]] and **bold** stuff.";
        const links = extractWikilinks(line);
        const tokens = tokenizeInlineLine(line, links);
        expect(tokens).toEqual([
            { kind: "text", value: "See " },
            { kind: "wikilink", target: "CUDA", label: "CUDA", isEmbed: false },
            { kind: "text", value: " and " },
            { kind: "bold", value: "bold" },
            { kind: "text", value: " stuff." },
        ]);
    });

    it("uses the alias as the label when present", () => {
        const line = "[[Blackwell architecture|Blackwell]] chip";
        const tokens = tokenizeInlineLine(line, extractWikilinks(line));
        expect(tokens[0]).toEqual({
            kind: "wikilink",
            target: "Blackwell architecture",
            label: "Blackwell",
            isEmbed: false,
        });
    });

    it("flags embeds", () => {
        const line = "![[chart.png]]";
        const tokens = tokenizeInlineLine(line, extractWikilinks(line));
        expect(tokens[0]).toMatchObject({ kind: "wikilink", isEmbed: true });
    });

    it("handles back-to-back wikilinks with nothing between them", () => {
        const line = "[[CUDA]][[TSMC]]";
        const tokens = tokenizeInlineLine(line, extractWikilinks(line));
        expect(tokens).toEqual([
            { kind: "wikilink", target: "CUDA", label: "CUDA", isEmbed: false },
            { kind: "wikilink", target: "TSMC", label: "TSMC", isEmbed: false },
        ]);
    });
});

describe("tokenizeBlockWithLinks", () => {
    it("preserves a heading prefix on a linked line", () => {
        const block = "## See [[CUDA]]";
        const links = extractWikilinks(block);
        const lines = tokenizeBlockWithLinks(block, links);
        expect(lines).toHaveLength(1);
        expect(lines[0].prefix).toEqual({ kind: "heading", level: 2 });
        expect(lines[0].tokens).toEqual([
            { kind: "text", value: "See " },
            { kind: "wikilink", target: "CUDA", label: "CUDA", isEmbed: false },
        ]);
    });

    it("preserves a bullet prefix on a linked line", () => {
        const block = "- see [[CUDA]] for details";
        const lines = tokenizeBlockWithLinks(block, extractWikilinks(block));
        expect(lines[0].prefix).toEqual({ kind: "bullet" });
        expect(lines[0].tokens[0]).toEqual({ kind: "text", value: "see " });
    });

    it("preserves an ordered-list prefix on a linked line", () => {
        const block = "3. compare with [[TSMC]]";
        const lines = tokenizeBlockWithLinks(block, extractWikilinks(block));
        expect(lines[0].prefix).toEqual({ kind: "ordered", number: 3 });
    });

    it("preserves a blockquote prefix on a linked line", () => {
        const block = "> quoting [[TSMC]] here";
        const lines = tokenizeBlockWithLinks(block, extractWikilinks(block));
        expect(lines[0].prefix).toEqual({ kind: "quote" });
    });

    it("handles multiple lines in one block, only some of which have a link", () => {
        const block = ["intro line", "- [[CUDA]] bullet", "trailing plain line"].join("\n");
        const lines = tokenizeBlockWithLinks(block, extractWikilinks(block));
        expect(lines).toHaveLength(3);
        expect(lines[0].prefix).toBeUndefined();
        expect(lines[0].tokens).toEqual([{ kind: "text", value: "intro line" }]);
        expect(lines[1].prefix).toEqual({ kind: "bullet" });
        expect(lines[1].tokens[0]).toEqual({ kind: "wikilink", target: "CUDA", label: "CUDA", isEmbed: false });
        expect(lines[2].tokens).toEqual([{ kind: "text", value: "trailing plain line" }]);
    });
});

describe("splitNoteBodyIntoBlocks", () => {
    it("keeps a link-free block as a single markdown block, verbatim", () => {
        const body = "# Heading\n\nSome plain prose with **bold** and no links.";
        const blocks = splitNoteBodyIntoBlocks(body, extractWikilinks(body));
        expect(blocks).toEqual([
            { kind: "markdown", text: "# Heading" },
            { kind: "markdown", text: "Some plain prose with **bold** and no links." },
        ]);
    });

    it("renders a block containing a wikilink as a linked block", () => {
        const body = "Intro paragraph.\n\nDepends on [[TSMC]] for wafers.";
        const blocks = splitNoteBodyIntoBlocks(body, extractWikilinks(body));
        expect(blocks[0]).toEqual({ kind: "markdown", text: "Intro paragraph." });
        expect(blocks[1].kind).toBe("linked");
        const linked = blocks[1] as ILinkedBlock;
        expect(linked.lines[0].tokens).toContainEqual({
            kind: "wikilink",
            target: "TSMC",
            label: "TSMC",
            isEmbed: false,
        });
    });

    it("does not treat a wikilink-looking string inside a fenced code block as a link (matches parse.ts's immunity)", () => {
        const body = "Some prose [[real]].\n\n```\nnot [[a link]] in code\n```";
        const blocks = splitNoteBodyIntoBlocks(body, extractWikilinks(body));
        // the fenced block has no real link matches, so it stays a plain markdown block
        expect(blocks[1]).toEqual({
            kind: "markdown",
            text: "```\nnot [[a link]] in code\n```",
        });
    });

    it("does not fragment a fenced code block that itself contains a blank line", () => {
        const body = "Intro.\n\n```\nline one\n\nline two (blank line above, still fenced)\n```\n\nOutro with [[a link]].";
        const blocks = splitNoteBodyIntoBlocks(body, extractWikilinks(body));
        expect(blocks).toHaveLength(3);
        expect(blocks[1]).toEqual({
            kind: "markdown",
            text: "```\nline one\n\nline two (blank line above, still fenced)\n```",
        });
    });

    it("round-trips block text losslessly for markdown blocks (no content dropped)", () => {
        const body = "Block one.\n\nBlock two.\n\nBlock three.";
        const blocks = splitNoteBodyIntoBlocks(body, []);
        expect(blocks.map((b) => (b.kind === "markdown" ? b.text : ""))).toEqual([
            "Block one.",
            "Block two.",
            "Block three.",
        ]);
    });

    it("handles an empty body", () => {
        expect(splitNoteBodyIntoBlocks("", [])).toEqual([]);
    });
});
