import { ArtifactFrame } from "./ArtifactFrame";
import { MermaidArtifactRenderer } from "./MermaidArtifactRenderer";
import { registerArtifactRenderer } from "./registry";

/**
 * Registers the v1 renderer set. Import this module once for its side
 * effect (e.g. from `ArtifactPanel.tsx`, P3) before rendering any artifact —
 * `getArtifactRenderer` returns `undefined` until these registrations run.
 */
export function registerDefaultArtifactRenderers(): void {
    registerArtifactRenderer("html", ArtifactFrame);
    registerArtifactRenderer("svg", ArtifactFrame);
    registerArtifactRenderer("mermaid", MermaidArtifactRenderer);
}
