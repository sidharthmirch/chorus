/**
 * W8 — Wiki Vault. Pure parsing logic: YAML frontmatter, [[wikilink]]
 * extraction (aliases + embeds, code-fence immune), headings, and wikilink
 * target resolution. Nothing in this file touches disk or the DB -- see
 * vault.ts / index.ts for the I/O layers that call into it. Kept pure so it
 * is fully unit-testable (parse.test.ts), per the P1 brief.
 */
import matter from "gray-matter";
import type { IHeading, IParsedNote, IResolvableFile, IWikilinkMatch } from "./types";

/** `data` from gray-matter is typed `unknown` here (see gray-matter.d.ts);
 *  narrow it before trusting it as a plain object. */
function toFrontmatterRecord(data: unknown): Record<string, unknown> {
    if (data && typeof data === "object" && !Array.isArray(data)) {
        // safe: just confirmed a non-array object immediately above
        return data as Record<string, unknown>;
    }
    return {};
}

export function parseFrontmatter(raw: string): {
    frontmatter: Record<string, unknown>;
    body: string;
} {
    const parsed = matter(raw);
    return { frontmatter: toFrontmatterRecord(parsed.data), body: parsed.content };
}

/** Inverse of parseFrontmatter: serializes a body + frontmatter object back
 *  into one file's raw text. Used for frontmatter-safe writes
 *  (wikiToolset.ts's `write_note`): when new content has no frontmatter of
 *  its own, the caller passes the EXISTING frontmatter here instead of
 *  losing it. No-ops (returns the body verbatim) when there's nothing to
 *  serialize. */
export function stringifyNote(body: string, frontmatter: Record<string, unknown>): string {
    if (Object.keys(frontmatter).length === 0) {
        return body;
    }
    return matter.stringify(body, frontmatter);
}

interface LineInfo {
    text: string;
    /** Offset of this line's first character in the original string. */
    start: number;
}

function splitLinesWithOffsets(text: string): LineInfo[] {
    const lines: LineInfo[] = [];
    let offset = 0;
    for (const line of text.split("\n")) {
        lines.push({ text: line, start: offset });
        offset += line.length + 1; // +1 for the split "\n"
    }
    return lines;
}

const FENCE_LINE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Per-line: is this line part of a fenced code block, including the fence
 * marker lines themselves? Shared by extractWikilinks (offset-based immune
 * ranges) and extractHeadings (a `#` inside a fence isn't a real heading).
 */
function computeFencedLines(lines: LineInfo[]): boolean[] {
    const fenced: boolean[] = lines.map(() => false);
    let fenceChar: string | null = null;
    let fenceLen = 0;

    for (let i = 0; i < lines.length; i++) {
        const match = FENCE_LINE_RE.exec(lines[i].text);
        if (fenceChar === null) {
            if (match) {
                fenceChar = match[1][0];
                fenceLen = match[1].length;
                fenced[i] = true;
            }
        } else {
            fenced[i] = true;
            const closes =
                match !== null &&
                match[1][0] === fenceChar &&
                match[1].length >= fenceLen &&
                lines[i].text.trim() === match[1];
            if (closes) {
                fenceChar = null;
                fenceLen = 0;
            }
        }
    }
    return fenced;
}

/** Matches a single-backtick inline code span on one line. Does not handle
 *  the rarer double-backtick-fenced inline span (used only when the code
 *  itself contains a literal backtick) -- a known v1 simplification. */
const INLINE_CODE_RE = /`[^`\n]*`/g;

/**
 * Ranges of blank-line runs (2+ consecutive `\n`) that are real markdown
 * block separators -- i.e. NOT bridging two points still inside the same
 * fenced code block. Used by inline.ts's note-body block splitter so a
 * fenced block containing a blank line doesn't fragment into pieces that
 * each carry only half a fence. A gap only counts as "still inside a
 * fence" when the line immediately before AND the line immediately after
 * are both fenced -- if either side has already closed (or not yet
 * opened) the fence, the gap is a real separator.
 */
export function getBlockSeparatorRanges(text: string): Array<[number, number]> {
    const lines = splitLinesWithOffsets(text);
    const fencedLines = computeFencedLines(lines);

    const ranges: Array<[number, number]> = [];
    const gapRe = /\n{2,}/g;
    let match: RegExpExecArray | null;
    while ((match = gapRe.exec(text))) {
        const gapStart = match.index;
        const gapEnd = match.index + match[0].length;
        const lineBeforeIdx = lines.findIndex((l) => l.start + l.text.length === gapStart);
        const lineAfterIdx = lines.findIndex((l) => l.start === gapEnd);
        const stillInsideFence =
            lineBeforeIdx !== -1 &&
            lineAfterIdx !== -1 &&
            fencedLines[lineBeforeIdx] &&
            fencedLines[lineAfterIdx];
        if (!stillInsideFence) {
            ranges.push([gapStart, gapEnd]);
        }
    }
    return ranges;
}

/**
 * Char-offset ranges (into the full text) that wikilink matching must
 * ignore: fenced code blocks in full, plus inline code spans on
 * non-fenced lines. Exported for testing; also useful if a future caller
 * wants to know "is this offset inside code".
 */
export function getImmuneRanges(text: string): Array<[number, number]> {
    const lines = splitLinesWithOffsets(text);
    const fencedLines = computeFencedLines(lines);
    const ranges: Array<[number, number]> = [];

    for (let i = 0; i < lines.length; i++) {
        const { text: lineText, start } = lines[i];
        if (fencedLines[i]) {
            ranges.push([start, start + lineText.length]);
            continue;
        }
        INLINE_CODE_RE.lastIndex = 0;
        let codeMatch: RegExpExecArray | null;
        while ((codeMatch = INLINE_CODE_RE.exec(lineText))) {
            ranges.push([start + codeMatch.index, start + codeMatch.index + codeMatch[0].length]);
        }
    }
    return ranges;
}

function isWithinRanges(pos: number, ranges: Array<[number, number]>): boolean {
    return ranges.some(([s, e]) => pos >= s && pos < e);
}

// Inner content: no `[`, `]`, or newline -- Obsidian wikilinks don't nest
// brackets or span lines. Optional leading `!` marks an embed/transclusion.
const WIKILINK_RE = /(!)?\[\[([^[\]\n]+)\]\]/g;

/** Extracts `[[wikilink]]` / `[[target|alias]]` / `![[embed]]` mentions from
 *  markdown, skipping anything inside fenced or inline code. */
export function extractWikilinks(text: string): IWikilinkMatch[] {
    const immune = getImmuneRanges(text);
    const matches: IWikilinkMatch[] = [];

    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(text))) {
        const start = m.index;
        if (isWithinRanges(start, immune)) continue;

        const inner = m[2];
        const pipeIndex = inner.indexOf("|");
        const target = (pipeIndex === -1 ? inner : inner.slice(0, pipeIndex)).trim();
        if (!target) continue; // guards against degenerate `[[|alias]]` / `[[ ]]`

        const aliasRaw = pipeIndex === -1 ? undefined : inner.slice(pipeIndex + 1).trim();
        matches.push({
            raw: m[0],
            target,
            alias: aliasRaw || undefined,
            isEmbed: m[1] === "!",
            start,
            end: start + m[0].length,
        });
    }
    return matches;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

/** Extracts ATX headings (`# ...` through `###### ...`), skipping fenced code. */
export function extractHeadings(text: string): IHeading[] {
    const lines = splitLinesWithOffsets(text);
    const fencedLines = computeFencedLines(lines);
    const headings: IHeading[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (fencedLines[i]) continue;
        const match = HEADING_RE.exec(lines[i].text);
        if (match) {
            headings.push({ level: match[1].length, text: match[2] });
        }
    }
    return headings;
}

/** Parses one note's raw file contents end to end: frontmatter, wikilinks,
 *  headings. Path-agnostic -- callers attach path/folder/title/updatedAt. */
export function parseNote(raw: string): IParsedNote {
    const { frontmatter, body } = parseFrontmatter(raw);
    return {
        frontmatter,
        body,
        links: extractWikilinks(body),
        headings: extractHeadings(body),
    };
}

export function folderOfPath(path: string): string {
    const idx = path.lastIndexOf("/");
    return idx === -1 ? "" : path.slice(0, idx);
}

export function topFolderOfPath(path: string): string {
    const idx = path.indexOf("/");
    return idx === -1 ? "" : path.slice(0, idx);
}

export function titleFromPath(path: string): string {
    const base = path.split("/").pop() ?? path;
    return base.replace(/\.md$/i, "");
}

/** The note's display title: an explicit frontmatter `title` wins, else the
 *  filename (without extension), matching Obsidian's convention. */
export function noteTitle(path: string, frontmatter: Record<string, unknown>): string {
    const fmTitle = frontmatter["title"];
    if (typeof fmTitle === "string" && fmTitle.trim().length > 0) {
        return fmTitle.trim();
    }
    return titleFromPath(path);
}

/**
 * Resolves a `[[target]]` mention to a vault-relative path, Obsidian-style:
 * exact path match first (extension optional, case-insensitive), then a
 * basename/title match anywhere in the vault (first match wins -- v1 does
 * not implement Obsidian's full "shortest unique path" disambiguation
 * among multiple same-named files in different folders).
 */
export function resolveWikilinkTarget(
    target: string,
    files: IResolvableFile[],
): string | undefined {
    const normalizedTarget = target.trim().replace(/\.md$/i, "").toLowerCase();
    if (!normalizedTarget) return undefined;

    const exact = files.find(
        (f) => f.path.replace(/\.md$/i, "").toLowerCase() === normalizedTarget,
    );
    if (exact) return exact.path;

    const targetBasename = normalizedTarget.split("/").pop() ?? normalizedTarget;
    const byBasename = files.find((f) => {
        const base = f.path.split("/").pop()?.replace(/\.md$/i, "").toLowerCase();
        return base === targetBasename || f.title.toLowerCase() === targetBasename;
    });
    return byBasename?.path;
}
