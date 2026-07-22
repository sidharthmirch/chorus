import { ProviderName } from "@core/chorus/Models";
import { FleetAgentId } from "./protocol";

/**
 * Maps a fleetd agent id to the existing `ProviderName` vocabulary so the
 * agent avatar can reuse `ProviderLogo` (`src/ui/components/ui/provider-
 * logo.tsx`) instead of introducing new per-provider brand-color hex
 * literals. The design mock colors each avatar with a raw hex swatch
 * (`P.anthropic = "#d97757"`, etc.) — that is a prototyping shortcut, not
 * part of the token system; DESIGN.md's Token-Only Rule and its rejection
 * of "purple-AI-tool branding" both argue against porting literal brand
 * hex into feature code. `ProviderLogo` already renders each provider's own
 * mark and already has a graceful fallback (`RiQuestionMark`) for an
 * unrecognized provider, so an agent id fleetd adds later just falls back
 * cleanly instead of breaking.
 */
const KNOWN_AGENT_PROVIDERS: Record<string, ProviderName> = {
    "claude-code": "anthropic",
    codex: "openai",
};

export function agentProviderName(agent: FleetAgentId): ProviderName | undefined {
    return KNOWN_AGENT_PROVIDERS[agent];
}

/** Display label for an agent id. All current ids are already display-ready (e.g. "claude-code", "codex"); this is a single seam if fleetd ever sends a separate raw-id/label pair. */
export function agentDisplayName(agent: FleetAgentId): string {
    return agent;
}
