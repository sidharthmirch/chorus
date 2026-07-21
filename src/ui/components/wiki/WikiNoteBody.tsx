import { Fragment, useMemo, type ReactNode } from "react";
import { MessageMarkdown } from "@ui/components/renderers/MessageMarkdown";
import { splitNoteBodyIntoBlocks, type IInlineLine, type IInlineToken } from "@core/chorus/wiki/inline";
import type { IWikilinkMatch } from "@core/chorus/wiki/types";
import { WikiLinkToken } from "./WikiLinkToken";

function InlineTokens({
    tokens,
    vaultPath,
    onNavigate,
}: {
    tokens: IInlineToken[];
    vaultPath: string | undefined;
    onNavigate: (path: string) => void;
}) {
    return (
        <>
            {tokens.map((token, i) => {
                switch (token.kind) {
                    case "text":
                        return <Fragment key={i}>{token.value}</Fragment>;
                    case "bold":
                        return <strong key={i}>{token.value}</strong>;
                    case "italic":
                        return <em key={i}>{token.value}</em>;
                    case "code":
                        return (
                            <code key={i} className="font-geist-mono text-sm">
                                {token.value}
                            </code>
                        );
                    case "wikilink":
                        return (
                            <WikiLinkToken
                                key={i}
                                vaultPath={vaultPath}
                                target={token.target}
                                label={token.label}
                                isEmbed={token.isEmbed}
                                onNavigate={onNavigate}
                            />
                        );
                }
            })}
        </>
    );
}

function LinkedLine({
    line,
    vaultPath,
    onNavigate,
}: {
    line: IInlineLine;
    vaultPath: string | undefined;
    onNavigate: (path: string) => void;
}) {
    const content = <InlineTokens tokens={line.tokens} vaultPath={vaultPath} onNavigate={onNavigate} />;

    if (!line.prefix) {
        // An empty line with no prefix and no tokens is a blank spacer line
        // within the block; give it some height so paragraphs inside a
        // linked block don't visually collapse together.
        if (line.tokens.length === 0) return <div className="h-4" />;
        return <p className="leading-[1.6]">{content}</p>;
    }

    switch (line.prefix.kind) {
        case "heading": {
            const HeadingTag = line.prefix.level === 1 ? "h1" : "h2";
            return (
                <HeadingTag
                    className={
                        line.prefix.level === 1
                            ? "text-lg font-medium mt-4"
                            : "text-base font-medium mt-3"
                    }
                >
                    {content}
                </HeadingTag>
            );
        }
        case "bullet":
            return (
                <div className="flex gap-2 leading-[1.6]">
                    <span className="text-muted-foreground select-none">•</span>
                    <span>{content}</span>
                </div>
            );
        case "ordered":
            return (
                <div className="flex gap-2 leading-[1.6]">
                    <span className="text-muted-foreground select-none font-geist-mono text-sm">
                        {line.prefix.number}.
                    </span>
                    <span>{content}</span>
                </div>
            );
        case "quote":
            return (
                <div className="border-l-2 border-border pl-3 text-muted-foreground leading-[1.6]">
                    {content}
                </div>
            );
    }
}

/**
 * Renders a note body with clickable [[wikilinks]]. Blocks with no
 * wikilinks render through MessageMarkdown untouched (full fidelity);
 * blocks that contain one are rendered line-by-line via inline.ts's
 * tokenizer instead. See .rework/w8-PROGRESS.md's decisions log for why.
 */
export function WikiNoteBody({
    body,
    links,
    vaultPath,
    onNavigate,
}: {
    body: string;
    links: IWikilinkMatch[];
    vaultPath: string | undefined;
    onNavigate: (path: string) => void;
}) {
    const blocks = useMemo(() => splitNoteBodyIntoBlocks(body, links), [body, links]);

    const rendered: ReactNode[] = blocks.map((block, i) => {
        if (block.kind === "markdown") {
            return <MessageMarkdown key={i} text={block.text} />;
        }
        return (
            <div key={i} className="flex flex-col gap-1">
                {block.lines.map((line, j) => (
                    <LinkedLine key={j} line={line} vaultPath={vaultPath} onNavigate={onNavigate} />
                ))}
            </div>
        );
    });

    return (
        <div className="text-base leading-[1.6] max-w-prose flex flex-col gap-3 select-text">
            {rendered}
        </div>
    );
}
