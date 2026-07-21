import { MermaidPreview } from "@ui/components/renderers/Mermaid";
import type { IArtifactRendererProps } from "./registry";

/**
 * Renders a "mermaid" IArtifact via the existing `MermaidPreview` component
 * (same one used inline in chat messages) rather than through `ArtifactFrame`
 * — see registry.ts for why mermaid isn't iframe-rendered in v1.
 */
export function MermaidArtifactRenderer({ artifact }: IArtifactRendererProps) {
    return (
        <div className="h-full w-full overflow-auto p-4">
            <MermaidPreview content={artifact.code} />
        </div>
    );
}
