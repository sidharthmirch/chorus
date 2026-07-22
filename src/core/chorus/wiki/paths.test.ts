import { describe, expect, it } from "vitest";
import { resolveWithinVault } from "./paths";

const VAULT = "/Users/alice/MyVault";

describe("resolveWithinVault", () => {
    it("allows a simple note at the vault root", () => {
        expect(resolveWithinVault(VAULT, "note.md")).toBe(`${VAULT}/note.md`);
    });

    it("allows a nested note", () => {
        expect(resolveWithinVault(VAULT, "concepts/transformer.md")).toBe(
            `${VAULT}/concepts/transformer.md`,
        );
    });

    it("allows internal .. that stays within the vault", () => {
        expect(resolveWithinVault(VAULT, "concepts/../notes/a.md")).toBe(
            `${VAULT}/notes/a.md`,
        );
    });

    it("rejects a single-level parent escape", () => {
        expect(() => resolveWithinVault(VAULT, "../secret.md")).toThrow(/escapes the vault/);
    });

    it("rejects a deep traversal escape", () => {
        expect(() =>
            resolveWithinVault(VAULT, "../../../../etc/passwd"),
        ).toThrow(/escapes the vault/);
    });

    it("rejects an absolute path", () => {
        expect(() => resolveWithinVault(VAULT, "/etc/passwd")).toThrow(
            /absolute path/,
        );
    });

    it("rejects a sibling-directory prefix trick", () => {
        // `/Users/alice/MyVault-evil/x` shares the root string prefix but is
        // NOT inside the vault — the `root + "/"` boundary check must catch it.
        expect(() => resolveWithinVault(VAULT, "../MyVault-evil/x.md")).toThrow(
            /escapes the vault/,
        );
    });

    it("allows the vault root itself (no relative segment)", () => {
        expect(resolveWithinVault(VAULT, "")).toBe(VAULT);
    });
});
