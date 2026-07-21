/**
 * W8 — Wiki Vault. wiki-mcp: a builtin toolset (no MCP server -- follows
 * `Toolsets.ts`'s `addCustomTool` pattern exactly, same as
 * `toolsets/web.ts`/`toolsets/media.ts`) so models can read/write the
 * user's vault from chat. This is what powers design/wiki.md's
 * "Transformer wiki rewrite" flow, e.g. "rewrite concepts/
 * transformer-architecture.md's intro". Writes always go through
 * vault.ts + index.ts (never raw fs), so the on-disk file and the search/
 * backlink cache never disagree.
 *
 * Registered in `ToolsetsManager.ts`'s `_builtInToolsets` (see that file's
 * comment for why this is an unavoidable, minimal, non-owned-file touch).
 * Starts disabled like every other builtin toolset; enabling it is a
 * small self-contained toggle in `WikiView.tsx`'s header rather than a
 * Settings.tsx change (Settings.tsx/the Connections tab aren't built on
 * this integration branch yet).
 */
import { Toolset } from "../Toolsets";
import { getVaultPath, noteExistsOnDisk, readNoteRaw } from "./vault";
import { getBacklinks, searchVault, writeNoteFrontmatterSafe } from "./index";

const NO_VAULT_MESSAGE =
    '<wiki_system_message>No wiki vault is configured yet. Ask the user to open the Wiki tab in Chorus, choose a vault folder, and enable wiki tools.</wiki_system_message>';

/** Args arrive as `Record<string, unknown>` from the LLM's tool call, not
 *  runtime-validated upstream -- narrow with a real check rather than an
 *  `as` cast (write_note especially is higher-stakes than a web fetch). */
function requireStringArg(args: Record<string, unknown>, field: string): string {
    const value = args[field];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`"${field}" must be a non-empty string`);
    }
    return value;
}

export class ToolsetWiki extends Toolset {
    constructor() {
        super(
            "wiki",
            "Wiki",
            {},
            "Read and write notes in the user's wiki vault (Obsidian-style Markdown with [[wikilinks]]).",
            "",
        );

        this.addCustomTool(
            "read_note",
            {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description:
                            'Vault-relative path to the note, e.g. "concepts/transformer-architecture.md".',
                    },
                },
                required: ["path"],
                additionalProperties: false,
            },
            async (args) => {
                const path = requireStringArg(args, "path");
                const vaultPath = await getVaultPath();
                if (!vaultPath) return NO_VAULT_MESSAGE;

                const exists = await noteExistsOnDisk(vaultPath, path);
                if (!exists) {
                    return `<wiki_system_message>"${path}" does not exist in this vault. Use write_note to create it.</wiki_system_message>`;
                }
                return readNoteRaw(vaultPath, path);
            },
            "Reads a note's full Markdown content, including YAML frontmatter, from the wiki vault.",
        );

        this.addCustomTool(
            "write_note",
            {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "Vault-relative path to create or update, e.g. \"concepts/kv-cache.md\".",
                    },
                    content: {
                        type: "string",
                        description:
                            "Full Markdown content to write. If this omits YAML frontmatter and the note already has some, the existing frontmatter is kept automatically and only the body is replaced.",
                    },
                },
                required: ["path", "content"],
                additionalProperties: false,
            },
            async (args) => {
                const path = requireStringArg(args, "path");
                const content = requireStringArg(args, "content");
                const vaultPath = await getVaultPath();
                if (!vaultPath) return NO_VAULT_MESSAGE;

                const existed = await noteExistsOnDisk(vaultPath, path);
                await writeNoteFrontmatterSafe(vaultPath, path, content);
                return `<wiki_system_message>${existed ? "Updated" : "Created"} "${path}".</wiki_system_message>`;
            },
            "Creates or updates a note in the wiki vault. Frontmatter-safe: writing body-only content to an existing note preserves its current frontmatter.",
        );

        this.addCustomTool(
            "search_vault",
            {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Text to search for across note titles and bodies.",
                    },
                },
                required: ["query"],
                additionalProperties: false,
            },
            async (args) => {
                const query = requireStringArg(args, "query");
                const vaultPath = await getVaultPath();
                if (!vaultPath) return NO_VAULT_MESSAGE;

                const results = await searchVault(vaultPath, query);
                if (results.length === 0) {
                    return `<wiki_system_message>No notes match "${query}".</wiki_system_message>`;
                }
                return results
                    .map((r) => `${r.path} (${r.linkCount} backlinks) -- ${r.snippet}`)
                    .join("\n");
            },
            "Searches note titles and bodies in the wiki vault. Returns matching file paths with a short snippet and backlink count each.",
        );

        this.addCustomTool(
            "get_backlinks",
            {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "Vault-relative path of the note to find backlinks for.",
                    },
                },
                required: ["path"],
                additionalProperties: false,
            },
            async (args) => {
                const path = requireStringArg(args, "path");
                const vaultPath = await getVaultPath();
                if (!vaultPath) return NO_VAULT_MESSAGE;

                const backlinks = await getBacklinks(vaultPath, path);
                if (backlinks.length === 0) {
                    return `<wiki_system_message>No notes link to "${path}" yet.</wiki_system_message>`;
                }
                return backlinks
                    .map((b) => `${b.sourcePath} -- "${b.context}"`)
                    .join("\n");
            },
            "Lists every note that links to the given note, with a short context snippet from each.",
        );
    }
}
