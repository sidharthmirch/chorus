import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import type { IArtifact } from "@core/chorus/artifacts/types";

function slugifyTitle(title: string): string {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "artifact";
}

/**
 * Wraps a bare `<svg>` fragment as a minimal standalone HTML document for
 * download — NOT the same wrapper as extract.ts's `assembleSvgDocument`
 * (that one also gets a CSP meta + is only ever used as `srcdoc`; a
 * downloaded file has no sandbox to protect and shouldn't carry that
 * artifact-preview-only wrapper).
 */
function wrapSvgForDownload(svg: string): string {
    return `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;">\n${svg}\n</body>\n</html>`;
}

function fileForDownload(artifact: IArtifact): { name: string; content: string } {
    const slug = slugifyTitle(artifact.title);
    switch (artifact.kind) {
        case "svg":
            return { name: `${slug}.html`, content: wrapSvgForDownload(artifact.code) };
        case "mermaid":
            // Mermaid source isn't HTML — save the raw diagram source instead
            // of mislabeling it as a .html file.
            return { name: `${slug}.mmd`, content: artifact.code };
        case "html":
        case "chart":
        case "table":
        default:
            return { name: `${slug}.html`, content: artifact.code };
    }
}

/**
 * Exports an artifact as a standalone file via the Tauri save dialog. Saves
 * `artifact.code` (the clean, user-facing source) — NOT `artifact.document`,
 * which carries our internal CSP meta + postMessage bridge script that only
 * make sense inside our own sandboxed preview.
 */
export async function downloadArtifact(artifact: IArtifact): Promise<void> {
    const { name, content } = fileForDownload(artifact);
    try {
        const destination = await save({
            defaultPath: name,
            filters:
                artifact.kind === "mermaid"
                    ? [{ name: "Mermaid", extensions: ["mmd", "txt"] }]
                    : [{ name: "HTML", extensions: ["html"] }],
        });
        if (!destination) return; // user cancelled

        await writeTextFile(destination, content);
        toast.success("Downloaded artifact");
    } catch (error) {
        console.error("Failed to download artifact:", error);
        toast.error("Couldn't download artifact", {
            description: error instanceof Error ? error.message : String(error),
        });
    }
}
