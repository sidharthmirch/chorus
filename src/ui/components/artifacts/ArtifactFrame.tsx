import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import RetroLoadingBar from "@ui/components/ui/retro-loader";
import { cn } from "@ui/lib/utils";
import type { IArtifact } from "@core/chorus/artifacts/types";

interface IArtifactFrameProps {
    artifact: IArtifact;
    /**
     * Bump this to force a full iframe remount (e.g. a manual "reload"
     * action) without the artifact itself changing. Combined with
     * `artifact.id` into the iframe's `key`, so switching versions already
     * remounts for free — this is only for an explicit refresh gesture.
     */
    reloadToken?: number;
    className?: string;
    /** Called when the artifact's own script throws or rejects, surfaced via the postMessage error bridge. */
    onError?: (message: string) => void;
}

interface IArtifactFrameMessage {
    type: "artifact-error" | "artifact-external-link";
    payload: unknown;
}

function isArtifactFrameMessage(data: unknown): data is IArtifactFrameMessage {
    return (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        (data.type === "artifact-error" || data.type === "artifact-external-link")
    );
}

/** Narrows the error payload without `as` — the shape is untrusted (it crossed a postMessage boundary from artifact-authored script). */
function describeErrorPayload(payload: unknown): string {
    if (
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
    ) {
        const line =
            "line" in payload && typeof payload.line === "number"
                ? `:${payload.line}`
                : "";
        return `${payload.message}${line}`;
    }
    return "Unknown error";
}

function getHrefFromPayload(payload: unknown): string | undefined {
    if (
        typeof payload === "object" &&
        payload !== null &&
        "href" in payload &&
        typeof payload.href === "string"
    ) {
        return payload.href;
    }
    return undefined;
}

/**
 * Renders an "html" or "svg" `IArtifact` in a sandboxed `<iframe srcdoc>`
 * per the frozen security contract (docs/rework/00-ARCHITECTURE.md §3.2):
 * `sandbox="allow-scripts allow-forms"` — NEVER `allow-same-origin`
 * alongside `allow-scripts` (that combination would expose the Tauri IPC
 * bridge to arbitrary model-authored script). Pure "svg" artifacts drop
 * `allow-scripts` entirely.
 *
 * The artifact's own runtime errors and external-link clicks reach us via a
 * postMessage bridge that `extractArtifacts` injects into `artifact.document`
 * (see `src/core/chorus/artifacts/extract.ts`'s `injectRuntimeBridge`) — we
 * cannot attach DOM listeners into the iframe directly from here, since a
 * sandboxed `srcdoc` frame without `allow-same-origin` has an opaque origin
 * and its `contentDocument` is unreachable from the parent.
 *
 * Do NOT extend/reuse `renderers/HTML.tsx` (the legacy full-page runner) —
 * this component only mirrors its postMessage error-shape convention.
 *
 * "mermaid"/"chart"/"table" artifacts are NOT rendered here — see
 * `src/ui/components/artifacts/registry.ts`'s `registerArtifactRenderer`.
 */
export function ArtifactFrame({
    artifact,
    reloadToken = 0,
    className,
    onError,
}: IArtifactFrameProps) {
    // Pre-authorized DOM ref (iframe handle) per .rework/ORCHESTRATION.md —
    // used only to verify postMessage events actually came from THIS
    // artifact's own frame (not unrelated app postMessage traffic, or a
    // sibling artifact frame in some future multi-panel layout).
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [runtimeError, setRuntimeError] = useState<string | undefined>(
        undefined,
    );
    // One-time check (not a live-updating listener — the OS setting almost
    // never changes mid-session, and RetroLoadingBar's animation is driven
    // by setInterval, not CSS, so a `motion-reduce:` Tailwind class can't
    // reach it anyway). Read via a lazy initializer so it's a pure read at
    // mount, not a side effect during render.
    const [prefersReducedMotion] = useState(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    const frameKey = `${artifact.id}:${reloadToken}`;

    // A new key means React is about to fully remount the iframe below —
    // reset local UI state to match the fresh load.
    useEffect(() => {
        setLoaded(false);
        setRuntimeError(undefined);
    }, [frameKey]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            const data: unknown = event.data;
            if (!isArtifactFrameMessage(data)) return;

            if (data.type === "artifact-error") {
                const message = describeErrorPayload(data.payload);
                setRuntimeError(message);
                onError?.(message);
                return;
            }

            const href = getHrefFromPayload(data.payload);
            // Defense-in-depth: the artifact runs untrusted, model-authored
            // code and controls this href entirely — only hand http(s) URLs to
            // the OS opener, never file:/javascript:/custom schemes.
            if (href && /^https?:\/\//i.test(href)) void openUrl(href);
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onError]);

    const sandbox =
        artifact.kind === "svg" ? "allow-forms" : "allow-scripts allow-forms";

    return (
        <div className={cn("relative h-full w-full bg-background", className)}>
            {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-background">
                    {prefersReducedMotion ? (
                        <span className="font-mono text-xs text-muted-foreground">
                            Loading…
                        </span>
                    ) : (
                        <RetroLoadingBar width={24} speed={480} />
                    )}
                </div>
            )}
            <iframe
                key={frameKey}
                ref={iframeRef}
                title={artifact.title}
                srcDoc={artifact.document}
                sandbox={sandbox}
                onLoad={() => setLoaded(true)}
                className="h-full w-full border-0"
            />
            {runtimeError && (
                <div
                    role="alert"
                    className="absolute inset-x-0 bottom-0 border-t border-border bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
                >
                    {runtimeError}
                </div>
            )}
        </div>
    );
}
