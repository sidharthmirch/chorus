import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { fetchMessage } from "@core/chorus/api/MessageAPI";
import { extractArtifacts } from "@core/chorus/artifacts/extract";
import { getArtifactRenderer } from "./registry";
import { registerDefaultArtifactRenderers } from "./defaultRenderers";

// Registering is idempotent (a Map.set on the same key just overwrites with
// the same value) — safe to call at module load in this standalone window.
registerDefaultArtifactRenderers();

function CenteredMessage({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
            {children}
        </div>
    );
}

/**
 * Content for the detached "open in window" artifact view
 * (`/artifact-window?messageId=...&artifactId=...`, opened by
 * `openArtifactWindow.ts` via a dynamically-created `WebviewWindow`).
 *
 * This window has no shared memory with the main window, so it re-derives
 * the artifact from scratch: fetch the source message, re-run the same pure
 * `extractArtifacts`, and find the artifact with the matching (deterministic)
 * id. See openArtifactWindow.ts for the rationale.
 */
export default function ArtifactWindowView() {
    const [searchParams] = useSearchParams();
    const messageId = searchParams.get("messageId") ?? "";
    const artifactId = searchParams.get("artifactId") ?? "";

    const messageQuery = useQuery({
        queryKey: ["artifact-window-message", messageId],
        queryFn: () => fetchMessage(messageId),
        enabled: messageId.length > 0,
    });

    const artifact = useMemo(() => {
        const message = messageQuery.data;
        if (!message) return undefined;
        const artifacts = extractArtifacts(message.text, {
            messageId: message.id,
            chatId: message.chatId,
            modelName: message.model,
        });
        return artifacts.find((candidate) => candidate.id === artifactId);
    }, [messageQuery.data, artifactId]);

    if (!messageId || !artifactId) {
        return <CenteredMessage>Missing artifact reference.</CenteredMessage>;
    }

    if (messageQuery.isLoading) {
        return <CenteredMessage>Loading…</CenteredMessage>;
    }

    if (messageQuery.isError || !artifact) {
        return <CenteredMessage>Artifact not found.</CenteredMessage>;
    }

    const Renderer = getArtifactRenderer(artifact.kind);
    if (!Renderer) {
        return <CenteredMessage>Unsupported artifact kind.</CenteredMessage>;
    }

    return (
        <div className="h-screen w-screen bg-background">
            <Renderer artifact={artifact} />
        </div>
    );
}
