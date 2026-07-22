/**
 * Fleet ↔ Orca integration. Thin, injectable process runner for the `orca`
 * CLI (github.com/stablyai/orca, onorca.dev) — the *only* place this
 * integration touches a process boundary. Mirrors how
 * `accounts/nineRouterClient.ts` injects `fetch`: production code gets
 * `createOrcaCommandRunner()`'s default (a real `Command.create("orca",
 * args)` via the already-present `@tauri-apps/plugin-shell`, no new Rust,
 * no new dependency), while `OrcaCliAdapter.test.ts` / `orcaMap.test.ts`
 * inject a stub `OrcaCommandRunner` — there is no `orca` binary in this dev
 * environment either, so every test runs against fixture strings, never a
 * real process.
 *
 * See `src-tauri/capabilities/default.json`'s `shell:allow-execute` scope:
 * an `{"name": "orca", "cmd": "orca", "args": true}` entry was appended
 * there (append-only) so `Command.create("orca", ...)` is permitted; no
 * `shell:allow-spawn` entry was needed since this only ever calls
 * `.execute()` (collects output), never `.spawn()` (streaming).
 */

import { Command } from "@tauri-apps/plugin-shell";

export interface OrcaCommandResult {
    stdout: string;
    exitCode: number;
}

export type OrcaCommandRunner = (args: string[]) => Promise<OrcaCommandResult>;

/** Must match the `name` (and `cmd`) registered in the `shell:allow-execute`
 * capability entry — see this file's header comment. */
const ORCA_PROGRAM = "orca";

/**
 * Builds a real `OrcaCommandRunner`. `program` exists as a seam for a future
 * `orca_bin` path override, but note a current limitation: Tauri's shell
 * capability scope pins the exact program name statically in
 * `capabilities/default.json`, so an arbitrary override path would need its
 * own matching capability entry to actually be permitted — not wired up in
 * v1 (see `OrcaCliAdapter.ts`'s header and `.rework/orca-PROGRESS.md`).
 */
export function createOrcaCommandRunner(
    program: string = ORCA_PROGRAM,
): OrcaCommandRunner {
    return async (args: string[]): Promise<OrcaCommandResult> => {
        const output = await Command.create(program, args).execute();
        return {
            stdout: output.stdout,
            // `code` is `number | null` — Tauri's shell plugin types it
            // nullable only for the case where the process was killed by a
            // signal (Unix). Treat that as a failure rather than pretend a
            // clean exit.
            exitCode: output.code ?? -1,
        };
    };
}

/** Shared default runner — the one real `orca` invocations in production
 * code go through (`OrcaCliAdapter`'s default constructor argument). */
export const runOrcaCommand: OrcaCommandRunner = createOrcaCommandRunner();
