/**
 * W8 — Wiki Vault. The filesystem + persistence layer: picking a vault
 * directory, persisting its path, walking it for `.md` files, reading and
 * writing note contents, and watching it for external changes. This is the
 * ONLY module that touches `@tauri-apps/plugin-fs` / `plugin-dialog` for
 * wiki purposes -- index.ts and the wiki-mcp toolset both go through it
 * rather than calling fs directly, so there is one place that understands
 * "what counts as a vault file."
 *
 * fs permissions: `src-tauri/capabilities/default.json` already grants
 * `fs:read-all` + `fs:write-all` + `fs:scope` (`allow: ["**\/*"]`) and
 * `dialog:default` (which includes `allow-open`) -- both pre-date this
 * workstream and are broad enough for an arbitrary user-chosen vault
 * directory. No capabilities changes were needed for W8; see
 * .rework/w8-PROGRESS.md.
 *
 * Git sync (v2, out of scope -- 00-ARCHITECTURE.md §7 / design/wiki.md's
 * "Sync (Future)" section) plugs in here: a git-aware vault would stage +
 * commit after writeNoteRaw, and a "pull latest" action would run before
 * re-indexing. Intentionally not stubbed with a no-op function, so as not
 * to imply a v1 capability that doesn't exist.
 */
import { open } from "@tauri-apps/plugin-dialog";
import {
    exists,
    mkdir,
    readDir,
    readTextFile,
    remove,
    stat,
    watch,
    writeTextFile,
    type UnwatchFn,
} from "@tauri-apps/plugin-fs";
import path from "path";
import { db } from "../DB";

const VAULT_PATH_KEY = "wiki_vault_path";

/** Directory names skipped entirely while walking the vault (version
 *  control internals, Obsidian's own config folder, trash). Any other
 *  dotfile/dot-directory is also skipped -- vaults commonly carry editor
 *  and OS metadata folders we have no business indexing. */
const EXCLUDED_DIR_NAMES = new Set([".git", ".obsidian", ".trash", "node_modules"]);

/** Opens the native "choose a folder" dialog. Returns undefined if the
 *  user cancels. */
export async function pickVaultDirectory(): Promise<string | undefined> {
    const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose a vault folder",
    });
    return typeof selected === "string" ? selected : undefined;
}

export async function getVaultPath(): Promise<string | undefined> {
    const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM app_metadata WHERE key = ?",
        [VAULT_PATH_KEY],
    );
    return rows[0]?.value || undefined;
}

export async function setVaultPath(vaultPath: string): Promise<void> {
    await db.execute(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
        [VAULT_PATH_KEY, vaultPath],
    );
}

export async function clearVaultPath(): Promise<void> {
    await db.execute("DELETE FROM app_metadata WHERE key = ?", [VAULT_PATH_KEY]);
}

async function walkDir(absoluteDir: string, relativeDir: string): Promise<string[]> {
    const entries = await readDir(absoluteDir);
    const fileResults: string[] = [];
    const dirPromises: Promise<string[]>[] = [];

    for (const entry of entries) {
        if (entry.isDirectory) {
            if (entry.name.startsWith(".") || EXCLUDED_DIR_NAMES.has(entry.name)) {
                continue;
            }
            dirPromises.push(walkDir(path.join(absoluteDir, entry.name), path.join(relativeDir, entry.name)));
        } else if (entry.isFile && entry.name.toLowerCase().endsWith(".md")) {
            fileResults.push(path.join(relativeDir, entry.name));
        }
    }

    const nested = await Promise.all(dirPromises);
    return [...fileResults, ...nested.flat()];
}

/** Recursively lists every `.md` file in the vault, as vault-relative,
 *  forward-slash-separated paths. Sibling directories are walked in
 *  parallel so this stays reasonable on a large (~1k file) vault. */
export async function listVaultFiles(vaultPath: string): Promise<string[]> {
    return walkDir(vaultPath, "");
}

export async function readNoteRaw(vaultPath: string, relativePath: string): Promise<string> {
    return readTextFile(path.join(vaultPath, relativePath));
}

export async function noteExistsOnDisk(vaultPath: string, relativePath: string): Promise<boolean> {
    return exists(path.join(vaultPath, relativePath));
}

export async function getNoteMtime(vaultPath: string, relativePath: string): Promise<Date> {
    const info = await stat(path.join(vaultPath, relativePath));
    return info.mtime ?? new Date();
}

/** Writes note content, creating parent directories as needed (used for
 *  both "save existing note" and "create new note" -- wiki-mcp's
 *  `write_note` and the in-wiki "create new note?" affordance both funnel
 *  through this, never raw fs). */
export async function writeNoteRaw(
    vaultPath: string,
    relativePath: string,
    content: string,
): Promise<void> {
    const absolutePath = path.join(vaultPath, relativePath);
    const dir = path.dirname(absolutePath);
    if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
    }
    await writeTextFile(absolutePath, content);
}

export async function deleteNoteRaw(vaultPath: string, relativePath: string): Promise<void> {
    await remove(path.join(vaultPath, relativePath));
}

/**
 * Watches the vault for external changes (another editor, git checkout,
 * etc.) and invokes `onChange` after Tauri's own debounce window. Returns
 * undefined (instead of throwing) if the watcher can't start -- e.g. the
 * Rust `tauri-plugin-fs` "watch" cargo feature is disabled -- so callers
 * degrade to relying on the manual "Rebuild index" action rather than
 * crashing the wiki surface. As of this writing the feature IS enabled
 * (src-tauri/Cargo.toml: `tauri-plugin-fs = { features = ["watch"] }`),
 * but that's Rust the user must actually compile to verify -- flagged on
 * the user-test queue in .rework/w8-PROGRESS.md.
 */
export async function watchVault(
    vaultPath: string,
    onChange: () => void,
): Promise<UnwatchFn | undefined> {
    try {
        return await watch(vaultPath, () => onChange(), {
            recursive: true,
            delayMs: 600,
        });
    } catch (error) {
        console.error("wiki: failed to start vault watcher", error);
        return undefined;
    }
}
