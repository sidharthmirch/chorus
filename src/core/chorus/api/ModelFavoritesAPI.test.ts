import { describe, expect, it } from "vitest";
// Tests target `ModelFavorites.ts` (the pure half) — `ModelFavoritesAPI.ts`
// imports `db` and isn't safely importable under this repo's vitest setup
// (see `ModelAccountView.ts`'s file header for the same landmine).
import { parsePinnedModelConfigIds, togglePinnedId } from "./ModelFavorites";

describe("parsePinnedModelConfigIds", () => {
    it("returns [] for undefined/missing values", () => {
        expect(parsePinnedModelConfigIds(undefined)).toEqual([]);
        expect(parsePinnedModelConfigIds("")).toEqual([]);
    });

    it("returns [] for malformed JSON instead of throwing", () => {
        expect(parsePinnedModelConfigIds("{not json")).toEqual([]);
    });

    it("returns [] for valid JSON that isn't an array", () => {
        expect(parsePinnedModelConfigIds('{"a":1}')).toEqual([]);
    });

    it("filters out non-string entries defensively", () => {
        expect(parsePinnedModelConfigIds('["a", 1, "b", null]')).toEqual(["a", "b"]);
    });

    it("round-trips a normal array", () => {
        expect(parsePinnedModelConfigIds('["sonnet","gpt"]')).toEqual(["sonnet", "gpt"]);
    });
});

describe("togglePinnedId", () => {
    it("adds an id that isn't present", () => {
        expect(togglePinnedId([], "sonnet")).toEqual(["sonnet"]);
        expect(togglePinnedId(["gpt"], "sonnet")).toEqual(["gpt", "sonnet"]);
    });

    it("removes an id that is present", () => {
        expect(togglePinnedId(["gpt", "sonnet"], "sonnet")).toEqual(["gpt"]);
    });

    it("does not mutate the input array", () => {
        const input = ["gpt"];
        togglePinnedId(input, "sonnet");
        expect(input).toEqual(["gpt"]);
    });
});
