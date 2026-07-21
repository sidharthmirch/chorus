import { describe, expect, it } from "vitest";
import { buildGradingPrompt, parseGradesResponse } from "./fusedGrading";

describe("buildGradingPrompt", () => {
    it("includes the synthesis text and every perspective's model id and text", () => {
        const prompt = buildGradingPrompt("FUSED_ANSWER_MARKER", [
            { model: "anthropic::claude", text: "CLAUDE_TEXT_MARKER" },
            { model: "openai::gpt", text: "GPT_TEXT_MARKER" },
        ]);

        expect(prompt).toContain("FUSED_ANSWER_MARKER");
        expect(prompt).toContain("anthropic::claude");
        expect(prompt).toContain("CLAUDE_TEXT_MARKER");
        expect(prompt).toContain("openai::gpt");
        expect(prompt).toContain("GPT_TEXT_MARKER");
    });

    it("instructs the model to respond with only JSON, no prose", () => {
        const prompt = buildGradingPrompt("answer", []);
        expect(prompt.toLowerCase()).toContain("json");
    });
});

describe("parseGradesResponse", () => {
    const validJson = JSON.stringify([
        {
            model: "anthropic::claude",
            score: 92,
            weightPct: 46,
            note: "structure, tables, citations",
        },
        { model: "openai::gpt", score: 78, weightPct: 30, note: "concise" },
    ]);

    it("parses a well-formed JSON array", () => {
        const grades = parseGradesResponse(validJson);
        expect(grades).toHaveLength(2);
        expect(grades?.[0]).toEqual({
            model: "anthropic::claude",
            score: 92,
            weightPct: 46,
            note: "structure, tables, citations",
        });
    });

    it("strips a markdown code fence the model added despite instructions not to", () => {
        const fenced = "```json\n" + validJson + "\n```";
        const grades = parseGradesResponse(fenced);
        expect(grades).toHaveLength(2);
    });

    it("clamps out-of-range scores/weights into 0-100", () => {
        const raw = JSON.stringify([
            { model: "m", score: 150, weightPct: -20, note: "x" },
        ]);
        const grades = parseGradesResponse(raw);
        expect(grades?.[0].score).toBe(100);
        expect(grades?.[0].weightPct).toBe(0);
    });

    it("rounds fractional scores/weights", () => {
        const raw = JSON.stringify([
            { model: "m", score: 91.6, weightPct: 45.4, note: "x" },
        ]);
        const grades = parseGradesResponse(raw);
        expect(grades?.[0].score).toBe(92);
        expect(grades?.[0].weightPct).toBe(45);
    });

    it("drops malformed entries but keeps well-formed siblings", () => {
        const raw = JSON.stringify([
            { model: "good", score: 80, weightPct: 50, note: "fine" },
            { model: "bad", score: "not-a-number", weightPct: 50, note: "x" },
            { score: 80, weightPct: 50, note: "missing model field" },
        ]);
        const grades = parseGradesResponse(raw);
        expect(grades).toHaveLength(1);
        expect(grades?.[0].model).toBe("good");
    });

    it("filters out grades for models that weren't actually being graded (hallucination guard)", () => {
        const raw = JSON.stringify([
            { model: "anthropic::claude", score: 90, weightPct: 60, note: "x" },
            { model: "made-up-model", score: 10, weightPct: 40, note: "y" },
        ]);
        const grades = parseGradesResponse(raw, ["anthropic::claude", "openai::gpt"]);
        expect(grades).toHaveLength(1);
        expect(grades?.[0].model).toBe("anthropic::claude");
    });

    it("returns undefined for non-JSON garbage", () => {
        expect(parseGradesResponse("I cannot grade this, sorry!")).toBeUndefined();
    });

    it("returns undefined for a JSON object that isn't an array", () => {
        expect(parseGradesResponse('{"model": "m"}')).toBeUndefined();
    });

    it("returns undefined for an empty array", () => {
        expect(parseGradesResponse("[]")).toBeUndefined();
    });

    it("returns undefined when every entry is malformed", () => {
        expect(parseGradesResponse('[{"foo": "bar"}]')).toBeUndefined();
    });

    it("returns undefined when expectedModels filters out everything", () => {
        const raw = JSON.stringify([
            { model: "unrelated", score: 80, weightPct: 100, note: "x" },
        ]);
        expect(
            parseGradesResponse(raw, ["anthropic::claude"]),
        ).toBeUndefined();
    });
});
