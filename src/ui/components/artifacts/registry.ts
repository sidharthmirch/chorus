import type { ComponentType } from "react";
import type { ArtifactKind, IArtifact } from "@core/chorus/artifacts/types";

/**
 * W2 — Inline Artifacts, renderer registry (architecture §3.1: "the design's
 * richer palettes ... are renderer kinds over the same IArtifact shape —
 * extensible via a registerArtifactRenderer map").
 *
 * v1 registers three kinds (see `defaultRenderers.tsx`): "html"/"svg" render
 * through `ArtifactFrame` (sandboxed iframe); "mermaid" renders directly via
 * the existing `MermaidPreview` React component (no iframe — mermaid source
 * has no script-injection risk, and there's no CDN available to load the
 * mermaid runtime inside a `connect-src 'none'` sandbox anyway). "chart"/
 * "table" are reserved for future producers (W6 fused pipeline / tool
 * outputs) and have no renderer registered in v1 — `getArtifactRenderer`
 * returns `undefined` for them; callers must render an "unsupported" state.
 */
export interface IArtifactRendererProps {
    artifact: IArtifact;
    /** Bump to force a full remount (e.g. a manual "reload" action). */
    reloadToken?: number;
    className?: string;
    /** Surfaces a runtime error from the artifact itself, if the renderer supports detecting one. */
    onError?: (message: string) => void;
}

export type ArtifactRenderer = ComponentType<IArtifactRendererProps>;

const renderers = new Map<ArtifactKind, ArtifactRenderer>();

export function registerArtifactRenderer(
    kind: ArtifactKind,
    renderer: ArtifactRenderer,
): void {
    renderers.set(kind, renderer);
}

export function getArtifactRenderer(
    kind: ArtifactKind,
): ArtifactRenderer | undefined {
    return renderers.get(kind);
}
