# Chorus Development Agent Guide

## Commands

-   **Dev:** `pnpm run vite:dev` (Vite), `npm run tauri:dev` (Tauri dev)
-   **Build:** `pnpm run build`
-   **QA/Prod:** `npm run tauri:qa`, `npm run tauri:prod`

## Code Style

-   **TypeScript:** Strict typing, ES2020 target. Avoid `as` casts.
-   **Paths:** Use `@ui/*`, `@core/*`, `@/*` aliases over relative imports.
-   **Naming:** PascalCase components, camelCase hooks with "use" prefix, "I"-prefixed interfaces.
-   **Formatting:** 4-space indentation, Prettier formatting.
-   **Imports:** Group by external, internal (@aliases), then relative.
-   **Error Handling:** All promises must be handled.

## Structure

-   **UI:** Components in `src/ui/components/`
-   **Core:** Business logic in `src/core/chorus/`
-   **Tauri:** Rust backend in `src-tauri/src/`

# Distill Usage

When piping command output through `distill`, always provide a quoted prompt argument.

Example:

```bash
command 2>&1 | distill "Summarize errors"
```
