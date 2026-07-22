import { describe, expect, it } from "vitest";
import { assignFolderColors } from "./folderColors";

describe("assignFolderColors", () => {
    it("maps the known design taxonomy to its intended token", () => {
        const colors = assignFolderColors(["companies", "concepts", "sectors", "sources"]);
        expect(colors.get("companies")).toBe("accent");
        expect(colors.get("concepts")).toBe("success");
        expect(colors.get("sectors")).toBe("warning");
        expect(colors.get("sources")).toBe("helper");
    });

    it("is case-insensitive on the known names", () => {
        const colors = assignFolderColors(["Companies", "CONCEPTS"]);
        expect(colors.get("Companies")).toBe("accent");
        expect(colors.get("CONCEPTS")).toBe("success");
    });

    it("maps the root ('' folder, files with no parent) to helper", () => {
        expect(assignFolderColors([""]).get("")).toBe("helper");
    });

    it("assigns an arbitrary folder name a stable color from the palette", () => {
        const colors = assignFolderColors(["my-custom-folder"]);
        expect(["accent", "success", "warning", "helper"]).toContain(
            colors.get("my-custom-folder"),
        );
    });

    it("is deterministic across calls for the same arbitrary folder name", () => {
        const first = assignFolderColors(["arbitrary-folder"]).get("arbitrary-folder");
        const second = assignFolderColors(["arbitrary-folder"]).get("arbitrary-folder");
        expect(first).toBe(second);
    });
});
