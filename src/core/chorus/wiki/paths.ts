/**
 * W8 — Wiki vault path containment (SECURITY-CRITICAL, pure logic).
 *
 * wiki-mcp's `read_note`/`write_note` tools (wikiToolset.ts) and the in-wiki
 * "create note?" affordance pass a MODEL- or link-controlled relative path
 * into the vault's fs helpers. The Tauri fs capability is scoped to `**\/*`
 * (see vault.ts header) — there is no OS-level backstop — so this app-level
 * check is the ONLY thing preventing a model (jailbroken, or steered via
 * prompt injection from earlier tool/web content in the same chat) or a
 * crafted `[[wikilink]]` from escaping the vault to read/overwrite arbitrary
 * files (`../../../.ssh/authorized_keys`, `/etc/passwd`, …).
 *
 * Implemented as pure string logic (NOT via the `path` module) on purpose:
 * `path` resolves to `path-browserify` (POSIX) in the app but to node's
 * OS-native `path` (win32 on a Windows dev box) under vitest, so relying on it
 * would make the guard behave differently in tests than at runtime. This
 * version treats BOTH `/` and `\` as separators (defense-in-depth) and
 * collapses `.`/`..` itself, so it is identical everywhere. Kept dependency-
 * free (no DB/Tauri imports) so it is unit-testable, unlike vault.ts.
 */

function stripTrailingSlash(p: string): string {
    return p.replace(/[/\\]+$/, "");
}

/**
 * Resolve a vault-relative note path to an absolute (POSIX-joined) path,
 * asserting it stays inside `vaultPath`. Throws on absolute inputs or any `..`
 * escape. Returns the vault root itself for an empty relative path.
 */
export function resolveWithinVault(vaultPath: string, relativePath: string): string {
    const root = stripTrailingSlash(vaultPath);
    if (relativePath === "") {
        return root;
    }

    const segments = relativePath.split(/[/\\]/);

    // Absolute inputs: a leading separator ("/x" or "\x" → first segment is
    // ""), or a Windows drive prefix ("C:...").
    if (segments[0] === "" || /^[a-zA-Z]:$/.test(segments[0])) {
        throw new Error(
            `wiki: refusing absolute path outside the vault: ${relativePath}`,
        );
    }

    const stack: string[] = [];
    for (const seg of segments) {
        if (seg === "" || seg === ".") continue;
        if (seg === "..") {
            if (stack.length === 0) {
                throw new Error(
                    `wiki: refusing path that escapes the vault: ${relativePath}`,
                );
            }
            stack.pop();
        } else {
            stack.push(seg);
        }
    }

    return stack.length > 0 ? `${root}/${stack.join("/")}` : root;
}
