/**
 * W8 — Wiki Vault. Pure tokenizer that lets the note body render clickable
 * [[wikilinks]] inline, without editing `renderers/**` (W2-owned; see
 * .rework/w8-PROGRESS.md's decisions log for why routing wikilinks through
 * MessageMarkdown's own `a`/`WebPreview` path doesn't work: it always
 * appends an external-link icon and its onClick opens the system browser,
 * with no override point available from a wrapper).
 *
 * Strategy: split the note body into blank-line-separated blocks. A block
 * with no wikilinks in it renders through MessageMarkdown untouched (full
 * fidelity -- headings/lists/tables/code/quotes all just work). A block
 * that DOES contain a wikilink is walked line-by-line here instead: a
 * simple block-prefix (heading/bullet/ordered/quote) is preserved, and the
 * remainder of the line is tokenized into plain-text runs (bold/italic/
 * inline-code, minimally) and wikilink tokens that the UI renders as real
 * React elements (WikiLinkToken.tsx) rather than markdown links.
 *
 * v1 simplifications, deliberate: no nested inline formatting (e.g. bold
 * containing a link), no markdown escape sequences (`\*`), no double-
 * backtick-fenced inline code. All uncommon inside a flowing prose
 * paragraph, which is what wikilinks live in per design/wiki.md's mock.
 */
import { getBlockSeparatorRanges } from "./parse";
import type { IWikilinkMatch } from "./types";

export type IInlineTextToken =
    | { kind: "text"; value: string }
    | { kind: "bold"; value: string }
    | { kind: "italic"; value: string }
    | { kind: "code"; value: string };

export type IInlineToken =
    | IInlineTextToken
    | { kind: "wikilink"; target: string; label: string; isEmbed: boolean };

export type ILinePrefix =
    | { kind: "heading"; level: number }
    | { kind: "bullet" }
    | { kind: "ordered"; number: number }
    | { kind: "quote" };

export interface IInlineLine {
    prefix?: ILinePrefix;
    tokens: IInlineToken[];
}

export interface IMarkdownBlock {
    kind: "markdown";
    text: string;
}

export interface ILinkedBlock {
    kind: "linked";
    lines: IInlineLine[];
}

export type INoteBodyBlock = IMarkdownBlock | ILinkedBlock;

const FORMATTING_RE = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(_([^_]+)_)/g;

/** Tokenizes a plain-text run for bold (`**x**`), inline code (`` `x` ``),
 *  and italic (`*x*` or `_x_`). */
export function tokenizeFormatting(text: string): IInlineTextToken[] {
    const tokens: IInlineTextToken[] = [];
    let cursor = 0;
    FORMATTING_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FORMATTING_RE.exec(text))) {
        if (match.index > cursor) {
            tokens.push({ kind: "text", value: text.slice(cursor, match.index) });
        }
        if (match[1] !== undefined) {
            tokens.push({ kind: "bold", value: match[2] });
        } else if (match[3] !== undefined) {
            tokens.push({ kind: "code", value: match[4] });
        } else if (match[5] !== undefined) {
            tokens.push({ kind: "italic", value: match[6] });
        } else if (match[7] !== undefined) {
            tokens.push({ kind: "italic", value: match[8] });
        }
        cursor = match.index + match[0].length;
    }
    if (cursor < text.length) {
        tokens.push({ kind: "text", value: text.slice(cursor) });
    }
    return tokens;
}

/** `links` offsets must already be relative to `lineText`. */
export function tokenizeInlineLine(lineText: string, links: IWikilinkMatch[]): IInlineToken[] {
    const sorted = [...links].sort((a, b) => a.start - b.start);
    const tokens: IInlineToken[] = [];
    let cursor = 0;
    for (const link of sorted) {
        if (link.start > cursor) {
            tokens.push(...tokenizeFormatting(lineText.slice(cursor, link.start)));
        }
        tokens.push({
            kind: "wikilink",
            target: link.target,
            label: link.alias ?? link.target,
            isEmbed: link.isEmbed,
        });
        cursor = Math.max(cursor, link.end);
    }
    if (cursor < lineText.length) {
        tokens.push(...tokenizeFormatting(lineText.slice(cursor)));
    }
    return tokens;
}

const HEADING_PREFIX_RE = /^(#{1,6})\s+/;
const BULLET_PREFIX_RE = /^[-*+]\s+/;
const ORDERED_PREFIX_RE = /^(\d+)\.\s+/;
const QUOTE_PREFIX_RE = /^>\s?/;

function splitLinePrefix(line: string): { prefix?: ILinePrefix; content: string; consumed: number } {
    let match = HEADING_PREFIX_RE.exec(line);
    if (match) {
        return {
            prefix: { kind: "heading", level: match[1].length },
            content: line.slice(match[0].length),
            consumed: match[0].length,
        };
    }
    match = BULLET_PREFIX_RE.exec(line);
    if (match) {
        return { prefix: { kind: "bullet" }, content: line.slice(match[0].length), consumed: match[0].length };
    }
    match = ORDERED_PREFIX_RE.exec(line);
    if (match) {
        return {
            prefix: { kind: "ordered", number: Number(match[1]) },
            content: line.slice(match[0].length),
            consumed: match[0].length,
        };
    }
    match = QUOTE_PREFIX_RE.exec(line);
    if (match) {
        return { prefix: { kind: "quote" }, content: line.slice(match[0].length), consumed: match[0].length };
    }
    return { content: line, consumed: 0 };
}

/** `links` offsets must already be relative to `blockText`. */
export function tokenizeBlockWithLinks(blockText: string, links: IWikilinkMatch[]): IInlineLine[] {
    const lines: IInlineLine[] = [];
    let lineStart = 0;
    for (const rawLine of blockText.split("\n")) {
        const lineEnd = lineStart + rawLine.length;
        const { prefix, content, consumed } = splitLinePrefix(rawLine);
        const linksOnLine = links
            .filter((l) => l.start >= lineStart && l.end <= lineEnd)
            .map((l) => ({ ...l, start: l.start - lineStart - consumed, end: l.end - lineStart - consumed }));
        lines.push({ prefix, tokens: tokenizeInlineLine(content, linksOnLine) });
        lineStart = lineEnd + 1; // +1 for the split "\n"
    }
    return lines;
}

/**
 * Turns parse.ts's block-separator gaps into the block text ranges between
 * them (the inverse: separators -> the spans they separate).
 */
function splitBlockRanges(text: string): Array<[number, number]> {
    const separators = getBlockSeparatorRanges(text);
    const ranges: Array<[number, number]> = [];
    let cursor = 0;
    for (const [sepStart, sepEnd] of separators) {
        ranges.push([cursor, sepStart]);
        cursor = sepEnd;
    }
    ranges.push([cursor, text.length]);
    return ranges.filter(([start, end]) => start < end);
}

/**
 * Splits a note body into blocks, deciding per-block whether it can render
 * through MessageMarkdown untouched (`links` offsets, from parse.ts's
 * `extractWikilinks`, must be relative to the SAME `body` string).
 */
export function splitNoteBodyIntoBlocks(body: string, links: IWikilinkMatch[]): INoteBodyBlock[] {
    return splitBlockRanges(body).map(([start, end]) => {
        const text = body.slice(start, end);
        const blockLinks = links
            .filter((l) => l.start >= start && l.end <= end)
            .map((l) => ({ ...l, start: l.start - start, end: l.end - start }));

        if (blockLinks.length === 0) {
            return { kind: "markdown", text };
        }
        return { kind: "linked", lines: tokenizeBlockWithLinks(text, blockLinks) };
    });
}
