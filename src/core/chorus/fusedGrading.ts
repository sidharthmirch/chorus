// Pure logic for the Fused view mode's grading step (P4). Kept separate from
// api/MessageAPI.ts's useComputeFusedGrades mutation (which owns the
// simpleLLM call + DB write) so the prompt-building and, especially, the
// untrusted-LLM-output parsing are independently unit-testable — same
// pure/wrapper split as ChatCompareSelection.ts vs ModelConfigChatAPI.ts.
// See docs/rework/w6-chat-recon.md §6.

import type { IGrade } from "./ChatState";

export interface GradingPerspective {
    model: string;
    text: string;
}

/**
 * Builds the grading prompt. Deliberately separate from
 * Prompts.SYNTHESIS_INTERJECTION (the fused *answer* itself) — grading is
 * always a second, independent call, never mixed into the synthesis prompt.
 * See docs/rework/w6-chat-recon.md §6 for why.
 */
export function buildGradingPrompt(
    synthesisText: string,
    perspectives: GradingPerspective[],
): string {
    const perspectiveBlocks = perspectives
        .map(
            (p) => `<response model="${p.model}">\n${p.text}\n</response>`,
        )
        .join("\n\n");

    return `You are grading how much each model's response contributed to a synthesized answer.

Fused answer:
${synthesisText}

Original responses:
${perspectiveBlocks}

For EACH model above, provide a grade. Respond with ONLY a JSON array (no prose, no markdown code fences), one object per model, shaped exactly like this example:
[{"model": "example-model-id", "score": 85, "weightPct": 40, "note": "structure, tables, citations"}]

Rules:
- "score" is an integer 0-100 rating overall answer quality on its own merits.
- "weightPct" is an integer 0-100 estimating how much this model's answer shaped the fused answer; weights across all models should sum to approximately 100.
- "note" is 3-6 words, lowercase, no trailing punctuation.
- Include exactly one object per model listed above, using its exact model id.`;
}

/**
 * Strips a leading/trailing markdown code fence if the model wrapped its
 * JSON in one despite being asked not to (common LLM behavior worth
 * defending against rather than assuming compliance).
 */
function stripCodeFence(raw: string): string {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    return fenceMatch ? fenceMatch[1] : trimmed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates one already-JSON.parsed element against IGrade's shape. This is
 * the "narrow an unknown right after runtime validation" case
 * ORCHESTRATION.md's `as`-policy explicitly permits — but it's implemented
 * as real field-by-field checks (not a blind cast) since this is untrusted
 * LLM output, not a DB row with a proven column set.
 */
function isValidGradeShape(value: unknown): value is IGrade {
    if (!isPlainObject(value)) return false;
    return (
        typeof value.model === "string" &&
        value.model.length > 0 &&
        typeof value.score === "number" &&
        Number.isFinite(value.score) &&
        typeof value.weightPct === "number" &&
        Number.isFinite(value.weightPct) &&
        typeof value.note === "string"
    );
}

/** Clamps a grade's numeric fields into their documented 0-100 range. */
function clampGrade(grade: IGrade): IGrade {
    return {
        ...grade,
        score: Math.max(0, Math.min(100, Math.round(grade.score))),
        weightPct: Math.max(0, Math.min(100, Math.round(grade.weightPct))),
    };
}

/**
 * Parses+validates a grading response. Returns undefined (never throws) on
 * any malformed input — callers should treat that as "grading failed,
 * degrade gracefully" (the fused answer itself already rendered
 * successfully via the separate, unaffected synthesis call).
 *
 * `expectedModels`, if given, filters the result down to grades whose
 * `model` was actually one of the models being graded — defends against the
 * LLM hallucinating an extra row or mis-copying a model id from the prompt.
 */
export function parseGradesResponse(
    raw: string,
    expectedModels?: string[],
): IGrade[] | undefined {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stripCodeFence(raw));
    } catch {
        return undefined;
    }

    if (!Array.isArray(parsed)) return undefined;

    const grades = parsed.filter(isValidGradeShape).map(clampGrade);
    if (grades.length === 0) return undefined;

    if (!expectedModels) return grades;

    const expectedSet = new Set(expectedModels);
    const filtered = grades.filter((g) => expectedSet.has(g.model));
    return filtered.length > 0 ? filtered : undefined;
}
