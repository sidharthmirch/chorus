import type { ArtifactKind, IArtifact, IExtractArtifactsMeta } from "./types";

/**
 * W2 — Inline Artifacts, core extraction. Pure TS, no UI, no I/O.
 *
 * Heuristics ported from open-webui's `getCodeBlockContents` /
 * `ContentRenderer.svelte` (see docs/rework/agents/W2-artifacts.md):
 *  - Detect fenced ```html, ```svg, and ```xml-containing-`<svg>` blocks.
 *  - Merge consecutive ```css / ```js fences into the preceding ```html
 *    group (wrapped as `<style>` in `<head>` / `<script>` before `</body>`).
 *  - Strip `<think>`/`<thought>`/`<details>` blocks first, so a model's
 *    scratch reasoning never gets mistaken for a final artifact.
 *  - Tolerate streaming partials: an unclosed fence simply never matches the
 *    closing-fence regex, so it is silently ignored until it closes.
 *  - Bare-HTML-document fallback: a message with no fences at all, whose
 *    body IS a full HTML document, still produces one "html" artifact.
 */

// ---------------------------------------------------------------------------
// Reasoning-block stripping
// ---------------------------------------------------------------------------

/** Tags whose contents must never be scanned for artifacts. */
const REASONING_TAGS = ["think", "thought", "details"];

/**
 * Removes `<think>`/`<thought>`/`<details>` blocks (closed or, for
 * streaming partials, still-open-to-end-of-string) from `text` before fence
 * scanning. Google emits `<thought>`; Chorus's own MessageMarkdown already
 * treats `<think>`/`<thought>` as reasoning (see renderers/MessageMarkdown.tsx).
 */
export function stripReasoningBlocks(text: string): string {
    let result = text;
    for (const tag of REASONING_TAGS) {
        const closedRe = new RegExp(
            `<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`,
            "gi",
        );
        result = result.replace(closedRe, "");

        // Streaming partial: an opening tag with no closing tag yet — the
        // model hasn't finished "thinking", so drop it and everything after.
        const openToEndRe = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*$`, "i");
        result = result.replace(openToEndRe, "");
    }
    return result;
}

// ---------------------------------------------------------------------------
// Fence scanning + grouping
// ---------------------------------------------------------------------------

interface IFenceMatch {
    lang: string;
    content: string;
}

/**
 * Requires a closing ``` — an unclosed fence (still streaming) simply never
 * matches, which is exactly the "tolerate streaming partials" behavior we
 * want.
 */
const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;

function scanFences(text: string): IFenceMatch[] {
    const matches: IFenceMatch[] = [];
    let m: RegExpExecArray | null;
    // Reset lastIndex defensively since FENCE_RE is a shared module-level regex.
    FENCE_RE.lastIndex = 0;
    while ((m = FENCE_RE.exec(text)) !== null) {
        const langToken = m[1].trim().split(/\s+/)[0]?.toLowerCase() ?? "";
        matches.push({ lang: langToken, content: m[2] });
    }
    return matches;
}

interface IHtmlGroup {
    kind: "html";
    html: string;
    css: string[];
    js: string[];
}

interface ISimpleGroup {
    kind: "svg" | "mermaid";
    code: string;
}

type IGroup = IHtmlGroup | ISimpleGroup;

const CSS_LANGS = new Set(["css"]);
const JS_LANGS = new Set(["js", "javascript"]);

/**
 * Groups fences per the open-webui heuristic: an `html` fence opens a group;
 * immediately-following `css`/`js` fences (prose in between is fine) merge
 * into it; any OTHER fence type (including a second `html`, an `svg`, or an
 * unrelated language) closes the currently-open group. A `css`/`js` fence
 * with no open `html` group is dropped — it never forms an artifact on its
 * own.
 */
function groupFences(fences: IFenceMatch[]): IGroup[] {
    const groups: IGroup[] = [];
    let current: IHtmlGroup | undefined;

    const flush = () => {
        if (current) {
            groups.push(current);
            current = undefined;
        }
    };

    for (const { lang, content } of fences) {
        if (lang === "html") {
            flush();
            current = { kind: "html", html: content, css: [], js: [] };
        } else if (CSS_LANGS.has(lang) && current) {
            current.css.push(content);
        } else if (JS_LANGS.has(lang) && current) {
            current.js.push(content);
        } else if (lang === "svg" || (lang === "xml" && /<svg[\s>]/i.test(content))) {
            flush();
            groups.push({ kind: "svg", code: content });
        } else if (lang === "mermaid") {
            flush();
            groups.push({ kind: "mermaid", code: content });
        } else {
            // Any other fence (including a stray css/js with nothing open)
            // breaks the "consecutive" chain.
            flush();
        }
    }
    flush();

    return groups;
}

// ---------------------------------------------------------------------------
// Bare-HTML-document fallback
// ---------------------------------------------------------------------------

function extractBareHtmlDocument(text: string): string | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    const looksLikeDocument =
        /^<!DOCTYPE\s+html/i.test(trimmed) ||
        (/<html[\s>]/i.test(trimmed) && /<\/html>/i.test(trimmed));
    return looksLikeDocument ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

/**
 * Wraps a possibly-bare HTML fragment into a full document (adding
 * `<html>`/`<head>`/`<body>` as needed), then merges css/js blocks in as
 * `<style>` (end of `<head>`) / `<script>` (end of `<body>`).
 */
function assembleHtmlDocument(
    htmlSource: string,
    cssBlocks: string[],
    jsBlocks: string[],
): string {
    let doc = htmlSource.trim();

    if (!/<html[\s>]/i.test(doc)) {
        doc = `<!DOCTYPE html>\n<html>\n<head></head>\n<body>\n${doc}\n</body>\n</html>`;
    } else if (!/<head[^>]*>/i.test(doc)) {
        doc = doc.replace(
            /<html([^>]*)>/i,
            (_m, attrs: string) => `<html${attrs}>\n<head></head>`,
        );
    }

    if (cssBlocks.length > 0) {
        const styleTag = `<style>\n${cssBlocks.join("\n\n")}\n</style>`;
        doc = /<\/head>/i.test(doc)
            ? doc.replace(/<\/head>/i, `${styleTag}\n</head>`)
            : doc.replace(
                  /<head([^>]*)>/i,
                  (_m, attrs: string) => `<head${attrs}>${styleTag}`,
              );
    }

    if (jsBlocks.length > 0) {
        const scriptTag = `<script>\n${jsBlocks.join("\n\n")}\n</script>`;
        doc = /<\/body>/i.test(doc)
            ? doc.replace(/<\/body>/i, `${scriptTag}\n</body>`)
            : `${doc}\n${scriptTag}`;
    }

    return doc;
}

function assembleSvgDocument(svgSource: string): string {
    return `<!DOCTYPE html>\n<html>\n<head></head>\n<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;">\n${svgSource}\n</body>\n</html>`;
}

// ---------------------------------------------------------------------------
// CSP injection (frozen security contract, architecture §3.2)
// ---------------------------------------------------------------------------

/**
 * "html" artifacts run inline scripts (sandbox `allow-scripts allow-forms`,
 * NEVER `allow-same-origin`). `connect-src 'none'` per v1 non-goals (no
 * network access from artifacts). `unsafe-eval` is included because small
 * hand-rolled HTML/JS artifacts (e.g. games) occasionally rely on
 * `Function`/`eval`-adjacent patterns; there is no same-origin exposure to
 * protect against since the iframe has no origin access regardless.
 */
export const HTML_ARTIFACT_CSP =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none';";

/**
 * Pure-SVG artifacts drop `allow-scripts` at the sandbox level (architecture
 * §3.2); no `script-src` directive is listed here either, so `default-src
 * 'none'` blocks script execution as defense in depth.
 */
export const SVG_ARTIFACT_CSP =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";

/**
 * Injects a CSP `<meta>` tag as the FIRST child of `<head>` — required
 * position per architecture §3.2. Falls back to synthesizing a `<head>` (or
 * a whole document) if the input is malformed; in practice `assembleHtml/
 * SvgDocument` always produce a `<head>`, so the primary branch is what
 * actually runs.
 */
export function injectCspMeta(html: string, cspContent: string): string {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

    const headOpenMatch = /<head([^>]*)>/i.exec(html);
    if (headOpenMatch) {
        const insertAt = headOpenMatch.index + headOpenMatch[0].length;
        return html.slice(0, insertAt) + meta + html.slice(insertAt);
    }

    const htmlOpenMatch = /<html([^>]*)>/i.exec(html);
    if (htmlOpenMatch) {
        const insertAt = htmlOpenMatch.index + htmlOpenMatch[0].length;
        return (
            html.slice(0, insertAt) + `<head>${meta}</head>` + html.slice(insertAt)
        );
    }

    return `<!DOCTYPE html><html><head>${meta}</head><body>${html}</body></html>`;
}

// ---------------------------------------------------------------------------
// Title derivation
// ---------------------------------------------------------------------------

function textOf(fragment: string): string {
    return fragment
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function deriveHtmlTitle(html: string): string {
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (titleMatch) {
        const t = textOf(titleMatch[1]);
        if (t) return t;
    }
    const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    if (h1Match) {
        const t = textOf(h1Match[1]);
        if (t) return t;
    }
    return "HTML preview";
}

export function deriveSvgTitle(svg: string): string {
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(svg);
    if (titleMatch) {
        const t = textOf(titleMatch[1]);
        if (t) return t;
    }
    return "SVG graphic";
}

export function deriveMermaidTitle(_code: string): string {
    return "Mermaid diagram";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function buildArtifact(
    group: IGroup,
    index: number,
    meta: IExtractArtifactsMeta,
): IArtifact {
    const id = `${meta.messageId}:artifact:${index}`;
    const createdAt = new Date();
    const base = {
        id,
        messageId: meta.messageId,
        chatId: meta.chatId,
        modelName: meta.modelName,
        createdAt,
    };

    if (group.kind === "html") {
        const code = assembleHtmlDocument(group.html, group.css, group.js);
        const document = injectCspMeta(code, HTML_ARTIFACT_CSP);
        return {
            ...base,
            kind: "html" as ArtifactKind,
            title: deriveHtmlTitle(code),
            language: "html",
            code,
            document,
        };
    }

    if (group.kind === "svg") {
        const code = group.code.trim();
        const document = injectCspMeta(assembleSvgDocument(code), SVG_ARTIFACT_CSP);
        return {
            ...base,
            kind: "svg" as ArtifactKind,
            title: deriveSvgTitle(code),
            language: "svg",
            code,
            document,
        };
    }

    // mermaid: rendered directly via the existing MermaidPreview React
    // component in v1 (no iframe), so `document` just mirrors `code`.
    const code = group.code.trim();
    return {
        ...base,
        kind: "mermaid" as ArtifactKind,
        title: deriveMermaidTitle(code),
        language: "mermaid",
        code,
        document: code,
    };
}

/**
 * Extracts renderable artifacts from a model message. Pure function of
 * (text, meta) — no I/O, no storage. Safe to call on partial/streaming text;
 * unclosed fences and unclosed reasoning blocks are simply ignored until
 * they close.
 */
export function extractArtifacts(
    text: string,
    meta: IExtractArtifactsMeta,
): IArtifact[] {
    const stripped = stripReasoningBlocks(text);
    const fences = scanFences(stripped);
    const groups = groupFences(fences);

    if (groups.length === 0) {
        const bareHtml = extractBareHtmlDocument(stripped);
        if (bareHtml) {
            groups.push({ kind: "html", html: bareHtml, css: [], js: [] });
        }
    }

    return groups.map((group, index) => buildArtifact(group, index, meta));
}
