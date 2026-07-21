import { describe, expect, it } from "vitest";
import {
    SETTINGS_SECTION_META,
    DEFAULT_SETTINGS_SECTION,
    isSettingsSectionId,
    resolveSettingsSection,
    type SettingsSectionId,
} from "./sectionMeta";

// Deliberately imports from `./sectionMeta`, not `./registry`: `registry.ts`
// pulls in the 5 section components, which transitively import
// `@core/chorus/DB.ts`'s module-top-level `await Database.load(...)` and
// crash under plain vitest ("window is not defined") — see sectionMeta.ts's
// doc comment and the file split it documents.

const SECTION_IDS: SettingsSectionId[] = SETTINGS_SECTION_META.map(
    (s) => s.id,
);

describe("SETTINGS_SECTION_META", () => {
    it("has exactly the 5 sections the rework spec calls for, in order", () => {
        expect(SECTION_IDS).toEqual([
            "accounts",
            "models",
            "modes",
            "connections",
            "app",
        ]);
    });

    it("has unique ids", () => {
        expect(new Set(SECTION_IDS).size).toBe(SECTION_IDS.length);
    });

    it("every section has a non-empty label, description, and at least one keyword", () => {
        for (const section of SETTINGS_SECTION_META) {
            expect(section.label.length).toBeGreaterThan(0);
            expect(section.description.length).toBeGreaterThan(0);
            expect(section.keywords.length).toBeGreaterThan(0);
        }
    });

    it("DEFAULT_SETTINGS_SECTION is the first registered section (Accounts)", () => {
        expect(DEFAULT_SETTINGS_SECTION).toBe("accounts");
        expect(SECTION_IDS[0]).toBe(DEFAULT_SETTINGS_SECTION);
    });
});

describe("isSettingsSectionId", () => {
    it("accepts every registered id", () => {
        for (const id of SECTION_IDS) {
            expect(isSettingsSectionId(id)).toBe(true);
        }
    });

    it("rejects pre-rework tab ids, garbage, and empty/nullish values", () => {
        expect(isSettingsSectionId("visible-models")).toBe(false);
        expect(isSettingsSectionId("not-a-real-section")).toBe(false);
        expect(isSettingsSectionId("")).toBe(false);
        expect(isSettingsSectionId(undefined)).toBe(false);
        expect(isSettingsSectionId(null)).toBe(false);
    });
});

describe("resolveSettingsSection", () => {
    it("passes through every current section id unchanged", () => {
        for (const id of SECTION_IDS) {
            expect(resolveSettingsSection(id)).toBe(id);
        }
    });

    it("maps every pre-rework 12-tab id onto a real, current section", () => {
        const legacyIds = [
            "general",
            "import",
            "system-prompt",
            "api-keys",
            "visible-models",
            "model-profiles",
            "prompt-profiles",
            "defaults",
            "connections",
            "permissions",
            "base-url",
        ];
        for (const legacyId of legacyIds) {
            const resolved = resolveSettingsSection(legacyId);
            expect(SECTION_IDS).toContain(resolved);
        }
    });

    it("maps the dead legacy quick-chat redirect onto App", () => {
        expect(resolveSettingsSection("quick-chat")).toBe("app");
    });

    it("falls back to the first section for unknown ids and nullish input", () => {
        expect(resolveSettingsSection("docs")).toBe(DEFAULT_SETTINGS_SECTION);
        expect(resolveSettingsSection("something-new")).toBe(
            DEFAULT_SETTINGS_SECTION,
        );
        expect(resolveSettingsSection(undefined)).toBe(
            DEFAULT_SETTINGS_SECTION,
        );
        expect(resolveSettingsSection(null)).toBe(DEFAULT_SETTINGS_SECTION);
        expect(resolveSettingsSection("")).toBe(DEFAULT_SETTINGS_SECTION);
    });

    // Specific, brief-mandated repoints (docs/rework/agents/W3-settings-rework.md):
    // ManageModelsBox's two CTAs must land on Accounts/Models respectively.
    it("resolves the two brief-mandated ManageModelsBox repoint targets", () => {
        expect(resolveSettingsSection("api-keys")).toBe("accounts");
        expect(resolveSettingsSection("visible-models")).toBe("models");
    });
});
