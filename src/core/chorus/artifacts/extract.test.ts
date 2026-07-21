import { describe, expect, it } from "vitest";
import {
    deriveHtmlTitle,
    deriveSvgTitle,
    extractArtifacts,
    injectCspMeta,
    stripReasoningBlocks,
} from "./extract";
import type { IExtractArtifactsMeta } from "./types";

const meta: IExtractArtifactsMeta = {
    messageId: "msg-1",
    chatId: "chat-1",
    modelName: "claude-opus",
};

function fence(lang: string, body: string): string {
    return "```" + lang + "\n" + body + "\n```";
}

describe("extractArtifacts — fence grouping", () => {
    it("extracts a single html artifact from a bare html fence", () => {
        const text = fence("html", "<div>hello</div>");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].kind).toBe("html");
        expect(artifacts[0].code).toContain("<div>hello</div>");
        // wrapped into a full document
        expect(artifacts[0].code).toMatch(/<html[\s>]/i);
    });

    it("merges a consecutive css fence into the preceding html group", () => {
        const text = [
            fence("html", "<div class='box'>hi</div>"),
            "some prose in between",
            fence("css", ".box { color: red; }"),
        ].join("\n\n");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].code).toContain("<style>");
        expect(artifacts[0].code).toContain(".box { color: red; }");
    });

    it("merges a consecutive js fence into the preceding html group", () => {
        const text = [
            fence("html", "<button id='b'>go</button>"),
            fence("js", "document.getElementById('b').onclick = () => {};"),
        ].join("\n\n");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].code).toContain("<script>");
        expect(artifacts[0].code).toContain("document.getElementById");
    });

    it("merges multiple css and js fences, in order, into one group", () => {
        const text = [
            fence("html", "<div></div>"),
            fence("css", "body { margin: 0; }"),
            fence("css", ".box { color: blue; }"),
            fence("js", "const a = 1;"),
            fence("js", "const b = 2;"),
        ].join("\n\n");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        const code = artifacts[0].code;
        expect(code.indexOf("margin: 0")).toBeLessThan(
            code.indexOf(".box { color: blue; }"),
        );
        expect(code.indexOf("const a = 1;")).toBeLessThan(
            code.indexOf("const b = 2;"),
        );
    });

    it("treats also javascript alias the same as js", () => {
        const text = [
            fence("html", "<div></div>"),
            fence("javascript", "console.log('hi');"),
        ].join("\n\n");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts[0].code).toContain("console.log('hi');");
    });

    it("produces two separate artifacts for two independent html fences", () => {
        const text = [fence("html", "<p>one</p>"), fence("html", "<p>two</p>")].join(
            "\n\n",
        );
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(2);
        expect(artifacts[0].code).toContain("<p>one</p>");
        expect(artifacts[1].code).toContain("<p>two</p>");
        expect(artifacts[0].id).not.toBe(artifacts[1].id);
    });

    it("drops a css/js fence that has no preceding html group", () => {
        const text = fence("css", ".box { color: red; }");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });

    it("closes the current html group when an unrelated fence appears, so a later css does not merge", () => {
        const text = [
            fence("html", "<div>one</div>"),
            fence("python", "print('hi')"),
            fence("css", ".box { color: red; }"),
        ].join("\n\n");
        const artifacts = extractArtifacts(text, meta);
        // html group flushed without the css; lone css afterwards is dropped
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].code).not.toContain("<style>");
    });

    it("ignores unrelated fenced languages entirely (e.g. a lone python block)", () => {
        const text = fence("python", "print('hi')");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });
});

describe("extractArtifacts — svg / xml edge cases", () => {
    it("extracts an svg artifact from a ```svg fence", () => {
        const text = fence("svg", "<svg><circle r='5'/></svg>");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].kind).toBe("svg");
        expect(artifacts[0].code).toBe("<svg><circle r='5'/></svg>");
    });

    it("extracts an svg artifact from a ```xml fence whose content contains <svg", () => {
        const text = fence("xml", "<svg width='10'><rect/></svg>");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].kind).toBe("svg");
    });

    it("ignores a ```xml fence that does not contain <svg", () => {
        const text = fence("xml", "<root><child/></root>");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });

    it("closes an open html group when an svg fence appears, producing two artifacts", () => {
        const text = [fence("html", "<div></div>"), fence("svg", "<svg></svg>")].join(
            "\n\n",
        );
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(2);
        expect(artifacts[0].kind).toBe("html");
        expect(artifacts[1].kind).toBe("svg");
    });
});

describe("extractArtifacts — mermaid", () => {
    it("extracts a mermaid artifact", () => {
        const text = fence("mermaid", "flowchart TD\n  A --> B");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].kind).toBe("mermaid");
        expect(artifacts[0].code).toContain("flowchart TD");
        // mermaid isn't iframe-rendered in v1; document mirrors code
        expect(artifacts[0].document).toBe(artifacts[0].code);
    });
});

describe("extractArtifacts — think/details stripping", () => {
    it("does not extract an artifact fenced inside a closed <think> block", () => {
        const text = `<think>\n${fence("html", "<div>scratch</div>")}\n</think>\n\nAll done.`;
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });

    it("does not extract an artifact fenced inside a closed <details> block", () => {
        const text = `<details>\n${fence("html", "<div>scratch</div>")}\n</details>\n\nAll done.`;
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });

    it("still extracts a real artifact that appears after a closed think block", () => {
        const text = `<think>reasoning about it</think>\n\n${fence("html", "<div>real</div>")}`;
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].code).toContain("<div>real</div>");
    });

    it("strips an unclosed streaming <think> block (and everything after it)", () => {
        const text = `Some preamble.\n\n<think>\nstill reasoning, ${fence(
            "html",
            "<div>not-yet-final</div>",
        )}`;
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });

    it("handles Google's <thought> tag the same way as <think>", () => {
        const text = `<thought>${fence("html", "<div>scratch</div>")}</thought>`;
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });
});

describe("extractArtifacts — streaming partials", () => {
    it("ignores an unclosed fence", () => {
        const text = "```html\n<div>still streaming...";
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });

    it("extracts only the closed artifact when one fence is closed and a later one is still streaming", () => {
        const text = `${fence("html", "<div>done</div>")}\n\n\`\`\`html\n<div>still streaming...`;
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].code).toContain("<div>done</div>");
    });
});

describe("extractArtifacts — bare HTML document fallback", () => {
    it("extracts a bare (unfenced) full HTML document", () => {
        const text =
            "<!DOCTYPE html>\n<html><head><title>Bare</title></head><body><p>hi</p></body></html>";
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].kind).toBe("html");
        expect(artifacts[0].title).toBe("Bare");
        // the fallback uses the trimmed text verbatim as the source
        expect(artifacts[0].code.trim()).toBe(text.trim());
    });

    it("does not treat plain prose as a bare HTML document", () => {
        const text = "Sure, here's how you'd do that in general terms.";
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(0);
    });

    it("prefers fenced groups over the bare-document fallback when both could apply", () => {
        // the message has a real fence, so the fallback path must not fire
        const text = fence("html", "<p>fenced</p>");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].code).toContain("<p>fenced</p>");
    });
});

describe("extractArtifacts — CSP meta position (architecture §3.2)", () => {
    it("injects the CSP meta as the first child of <head> for html artifacts", () => {
        const text = fence("html", "<p>x</p>");
        const artifacts = extractArtifacts(text, meta);
        const headMatch = /<head[^>]*>([\s\S]*)/i.exec(artifacts[0].document);
        expect(headMatch).not.toBeNull();
        const afterHead = headMatch![1];
        expect(afterHead.trimStart().startsWith("<meta")).toBe(true);
        expect(afterHead).toMatch(/^\s*<meta http-equiv="Content-Security-Policy"/);
    });

    it("injects the CSP meta as the first child of <head> for svg artifacts", () => {
        const text = fence("svg", "<svg></svg>");
        const artifacts = extractArtifacts(text, meta);
        const headMatch = /<head[^>]*>([\s\S]*)/i.exec(artifacts[0].document);
        expect(headMatch).not.toBeNull();
        expect(headMatch![1].trimStart().startsWith("<meta")).toBe(true);
    });

    it("the html document's code (Code tab) does NOT contain the CSP meta", () => {
        const text = fence("html", "<p>x</p>");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts[0].code).not.toContain("Content-Security-Policy");
        expect(artifacts[0].document).toContain("Content-Security-Policy");
    });
});

describe("injectCspMeta (unit)", () => {
    it("inserts right after an existing <head> open tag", () => {
        const result = injectCspMeta("<html><head><title>t</title></head></html>", "csp");
        expect(result).toBe(
            '<html><head><meta http-equiv="Content-Security-Policy" content="csp"><title>t</title></head></html>',
        );
    });

    it("synthesizes a <head> when only <html> is present", () => {
        const result = injectCspMeta("<html><body>x</body></html>", "csp");
        expect(result).toContain(
            '<html><head><meta http-equiv="Content-Security-Policy" content="csp"></head><body>',
        );
    });

    it("synthesizes a full document when neither <html> nor <head> is present", () => {
        const result = injectCspMeta("<p>x</p>", "csp");
        expect(result.startsWith("<!DOCTYPE html>")).toBe(true);
        expect(result).toContain(
            '<head><meta http-equiv="Content-Security-Policy" content="csp"></head>',
        );
    });
});

describe("stripReasoningBlocks (unit)", () => {
    it("removes closed think/thought/details blocks", () => {
        expect(stripReasoningBlocks("<think>x</think>rest")).toBe("rest");
        expect(stripReasoningBlocks("<thought>x</thought>rest")).toBe("rest");
        expect(stripReasoningBlocks("<details>x</details>rest")).toBe("rest");
    });

    it("removes an unclosed trailing block entirely", () => {
        expect(stripReasoningBlocks("keep this<think>never closes")).toBe(
            "keep this",
        );
    });

    it("leaves text with no reasoning tags untouched", () => {
        expect(stripReasoningBlocks("plain text")).toBe("plain text");
    });
});

describe("title derivation (unit)", () => {
    it("prefers <title> for html", () => {
        expect(deriveHtmlTitle("<html><head><title>  My App  </title></head></html>")).toBe(
            "My App",
        );
    });

    it("falls back to <h1> for html when there is no <title>", () => {
        expect(deriveHtmlTitle("<body><h1>Heading <b>Text</b></h1></body>")).toBe(
            "Heading Text",
        );
    });

    it("falls back to a generic label for html with neither", () => {
        expect(deriveHtmlTitle("<div>no title here</div>")).toBe("HTML preview");
    });

    it("prefers <title> for svg", () => {
        expect(deriveSvgTitle("<svg><title>Chart</title></svg>")).toBe("Chart");
    });

    it("falls back to a generic label for svg without <title>", () => {
        expect(deriveSvgTitle("<svg></svg>")).toBe("SVG graphic");
    });
});

describe("extractArtifacts — id stability", () => {
    it("produces the same ids across repeated calls with the same input", () => {
        const text = [fence("html", "<p>a</p>"), fence("html", "<p>b</p>")].join(
            "\n\n",
        );
        const first = extractArtifacts(text, meta);
        const second = extractArtifacts(text, meta);
        expect(first.map((a) => a.id)).toEqual(second.map((a) => a.id));
    });

    it("carries messageId/chatId/modelName from meta onto every artifact", () => {
        const text = fence("html", "<p>a</p>");
        const artifacts = extractArtifacts(text, meta);
        expect(artifacts[0].messageId).toBe(meta.messageId);
        expect(artifacts[0].chatId).toBe(meta.chatId);
        expect(artifacts[0].modelName).toBe(meta.modelName);
    });
});
