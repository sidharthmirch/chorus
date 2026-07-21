/**
 * W2 — Inline Artifacts. Frozen contract, see docs/rework/00-ARCHITECTURE.md §3.1.
 *
 * Artifacts are a *pure derivation* of message content (v1: no persistence,
 * no migration). `extractArtifacts` in `extract.ts` is the only producer of
 * `IArtifact` in v1; future producers (W6 fused pipeline, tool outputs) will
 * emit the same shape for kinds "chart"/"table".
 */

/**
 * v1 extraction only ever produces "html" | "svg" | "mermaid". "chart" and
 * "table" are reserved for future producers (W6 fused pipeline / tool
 * outputs) that share this same shape — see `registerArtifactRenderer` in
 * `src/ui/components/artifacts/registry.ts`.
 */
export type ArtifactKind = "html" | "svg" | "mermaid" | "chart" | "table";

export interface IArtifact {
    id: string;
    messageId: string;
    chatId: string;
    modelName: string;
    kind: ArtifactKind;
    /** Derived title for the panel header (e.g. `<title>` content, or a kind-specific fallback). */
    title: string;
    /** Syntax-highlighting language for the Code tab (mirrors `kind` in v1). */
    language: string;
    /** Assembled source shown on the Code tab (html+css+js merged for "html"; raw source otherwise). */
    code: string;
    /**
     * Assembled payload for the Preview tab. For "html"/"svg" this is a full
     * HTML document with the CSP `<meta>` injected first in `<head>`, ready
     * to hand to `<iframe srcdoc>` (see ArtifactFrame, P2). For "mermaid" this
     * is not iframe-rendered in v1 (rendered directly via the existing
     * MermaidPreview React component) so `document` just mirrors `code`.
     */
    document: string;
    /**
     * Extraction-time timestamp. NOTE: `extractArtifacts` is a pure function
     * of (text, meta) only — it does not receive the message's own
     * created-at. Callers that need chronological ordering ACROSS messages
     * (P5 versioning) must sort by the *message's* timestamp, not this
     * field. Callers MUST memoize `extractArtifacts` per message (e.g.
     * `useMemo` keyed on `messageId` + `text`) so `createdAt` (and object
     * identity) stay stable across re-renders.
     */
    createdAt: Date;
}

export interface IExtractArtifactsMeta {
    messageId: string;
    chatId: string;
    modelName: string;
}
