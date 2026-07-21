import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { toast } from "sonner";
import type { IArtifact } from "@core/chorus/artifacts/types";

function sanitizeWindowLabel(id: string): string {
    return `artifact-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/**
 * Opens an artifact detached in its own Tauri window. The new window has no
 * shared JS memory with the main window, so rather than serializing the
 * (potentially large) assembled document through a URL or IPC event, we
 * hand it just `messageId` + `artifactId` — the new window's route
 * (`/artifact-window`, see `ArtifactWindowView.tsx`) re-fetches the source
 * message and re-runs the same pure `extractArtifacts` to reconstruct the
 * identical artifact (ids are deterministic, so this always finds the same
 * one). This matches the "derivation, not storage" philosophy of the whole
 * feature (architecture §3.1) instead of introducing a second, ad hoc
 * transport for artifact content.
 *
 * `core:webview:allow-create-webview-window` is already granted in
 * `src-tauri/capabilities/default.json` — no capability change needed.
 *
 * NOT TESTED against a running app (this workstream cannot run Tauri) — see
 * PROGRESS.md's user-test queue.
 */
export async function openArtifactInWindow(artifact: IArtifact): Promise<void> {
    const label = sanitizeWindowLabel(artifact.id);

    try {
        const existing = await WebviewWindow.getByLabel(label);
        if (existing) {
            await existing.setFocus();
            return;
        }

        const url = `/artifact-window?messageId=${encodeURIComponent(
            artifact.messageId,
        )}&artifactId=${encodeURIComponent(artifact.id)}`;

        const win = new WebviewWindow(label, {
            url,
            title: artifact.title,
            width: 900,
            height: 700,
            minWidth: 360,
            minHeight: 280,
        });

        void win.once("tauri://error", (event) => {
            console.error("Failed to open artifact window:", event);
            toast.error("Couldn't open artifact in a new window");
        });
    } catch (error) {
        console.error("Failed to open artifact window:", error);
        toast.error("Couldn't open artifact in a new window");
    }
}
