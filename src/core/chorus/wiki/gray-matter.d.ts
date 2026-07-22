/**
 * Minimal local type shim for `gray-matter` (^4.0.3, declared in
 * package.json). The package ships no `.d.ts` and there is no
 * `@types/gray-matter` installed in this worktree's `node_modules` junction
 * (and we cannot `pnpm add` a types package here -- see
 * .rework/ORCHESTRATION.md). This covers only the surface we use: the
 * default export as a callable returning `{ data, content }`, plus its
 * attached `.stringify()` (frontmatter-safe writes, wikiToolset.ts).
 */
declare module "gray-matter" {
    interface GrayMatterFile {
        data: unknown;
        content: string;
        excerpt?: string;
    }

    interface GrayMatterInstance {
        (input: string, options?: Record<string, unknown>): GrayMatterFile;
        stringify(
            content: string,
            data: Record<string, unknown>,
            options?: Record<string, unknown>,
        ): string;
    }

    const matter: GrayMatterInstance;
    export = matter;
}
