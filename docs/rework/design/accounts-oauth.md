# Accounts & OAuth Feature Directive (W1)

## Overview

The Accounts section in Settings (see settings.md) and model quota surfaces display provider OAuth/API key status and quota meters. This directive defines the OAuth model, badge semantics, quota refresh flow, and how quotas cascade through the app.

## Providers & Auth Methods

Supported provider list (from mock `catalogDefs`):

| Provider | Auth Method | Tier Label | Example |
|----------|-------------|------------|---------|
| Anthropic | OAuth 2.1 + PKCE | "max" or quota-limited | "anthropic oauth · max" |
| OpenAI | OAuth 2.1 + PKCE | "pro" (pro plan) | "openai oauth · pro" |
| Google AI | OAuth 2.1 + PKCE | "ai pro" | "google oauth · ai pro" |
| OpenRouter | API key | N/A (pay-per-use) | "openrouter · $8.20" |
| Ollama | None (local) | "local" | "ollama · local" |
| GitHub Copilot | OAuth 2.1 + PKCE | "pro" | (future) |

**No Anthropic max-quota limit:** Design note says "anthropic oauth · max" but current implementation may have per-model rate limits. To clarify: in mock, Anthropic shows 62% quota (bounded); treat as fallback to practical rate-limit tier.

## OAuth 2.1 + PKCE Flow (W1 Specification)

### Initiation

**UI trigger:** "Connect" button or "Manage" button in provider card (settings.md)

1. **TS side:** Call Tauri command `oauth_start(provider, auth_url)`
2. **Rust side:** Opens system browser to auth_url
3. **Browser:** User consents, provider redirects to callback

### Callback Handling

1. **Redirect URL:** `chorus://oauth/callback?code=...&state=...` (deep link via tauri-plugin-deep-link)
2. **Fallback:** If provider rejects custom scheme, use loopback `http://127.0.0.1:<port>/callback`
3. **Rust emits:** `oauth-callback` event with full redirect URL
4. **TS receives:** Event handler completes code exchange (POST to token endpoint with PKCE verifier)

### Token Storage (macOS Keychain)

- **Secret tokens stored:** accessToken, refreshToken (if provider supports)
  - Rust command: `secret_set(service, account, value)`
  - Service name: "Chorus.oauth"
  - Account name: `{provider}:{accountEmail}`

- **Non-secret stored in DB** (`oauth_config` JSON column):
  - provider, accountEmail, scopes, grantedAt, expiresAt, refreshUrl
  - Allows token refresh without re-auth

### Refresh Flow

1. **On app startup:** Check all stored tokens for expiry
2. **On 401 from API:** Catch, attempt refresh (POST to refreshUrl with refresh_token)
3. **On expiry:** Show "Reauthorize" action in provider card
4. **User clicks:** Re-runs oauth_start() flow

## Quota Model

### Storage & Refresh

**Local cache:** In `oauth_config` JSON:
```json
{
  "quotaPercentage": 62,
  "quotaWindow": "3h",
  "quotaRefreshed": "2026-07-21T14:30:00Z",
  "quotaNextReset": "2026-07-21T17:30:00Z"
}
```

**Refresh strategy:**
- On app startup: Fetch latest quotas from provider (if <1h since last refresh, use cached)
- Background: Poll every 60 minutes (or use provider webhooks if available)
- Fallback: If network unavailable, display cached values with "stale" indicator

**API endpoints** (per provider):
- Anthropic: `GET /accounts` (returns usage %)
- OpenAI: `GET /usage/usage_summary` (returns usage $ and remaining)
- Google: `GET /quotas` (returns quota info per model)

### Quota Windows

**Semantics:** Quota resets at fixed intervals:
- "3h" = sliding window last 3 hours
- "6h" = sliding window last 6 hours
- "1d" = daily reset (UTC midnight)
- "monthly" = monthly reset (1st of month)
- "pay/use" = no quota (OpenRouter, charge per token)

**Display:** Show reset time only if >80% utilization. Example:
- "62% · 3h" (normal, green)
- "84% · 6h ⚠" (warning, amber)
- "100% · resets tomorrow" (over quota, red, helpful hint)

### Quota-Aware Fallback (Fleet Feature)

In Fleet cost presets (see fleet.md):

> "quota-aware: falls to GPT-5.2 when Anthropic meter > 90%"

**Logic:** When composing requests:
1. Check selectedModels list
2. For each model, check live quota
3. If any model ≥ 90% quota, remove from selected set
4. If removed, auto-select fallback (next model in list, or GPT-5.2 default)
5. Display notification: "Anthropic quota high, using GPT-5.2 instead"

**Implementation:** Wrapper in composer or fleet planner agent.

## UI Surfaces

### Settings › Accounts Section

See settings.md for card layout. Quota bar appears on each provider card:
- Bar height: 4px
- Bar color: `success` (green) if <80%, `warning` (amber) if ≥80%
- Label: "62% · 3h" (11px monospace, muted)

### Composer › Manage Models Modal

See model-select.md. Each model row shows quota:
- Same quota bar (58px wide, 4px tall)
- Color-coded per threshold
- Window label (3h, 6h, 1d, monthly, pay/use)

### Chat Message Cost Badges

(Optional, gated by "Show model cost" setting in App section)
- Small badge next to model name in sender row
- Format: "$0.011" (11px monospace, muted)
- Color: Green if under average, amber if above

## OAuth Badge Semantics

**Badges in model rows:**

| Badge | Meaning | Example |
|-------|---------|---------|
| "anthropic oauth · max" | Using OAuth, no quota limit | Sonnet 4.5 |
| "openai oauth · pro" | Using OAuth, pro tier (higher quota) | GPT-5.2 |
| "google oauth · ai pro" | Using OAuth, Google AI Pro tier | Gemini 3 Pro |
| "openrouter · $8.20" | API key auth, pay-per-use | Llama 4 |
| "ollama · local" | No auth, local inference | Qwen3-72B |

**Status indicators (small colored dot):**
- Green: Authenticated, quota OK
- Amber: Authenticated, quota warning (>80%)
- Red: Not authenticated OR quota exhausted
- Gray: Unconfigured / unavailable

## Authorization UI

### New Provider Flow

1. **User clicks "Connect" on provider card**
2. **Modal appears:** "Authorize Claude with [Provider]"
   - Explanation: "We'll open your browser to grant access"
   - Button: "Open authorization"
3. **Browser opens** → provider OAuth consent screen
4. **User consents** → redirects to callback → TS completes exchange
5. **Success screen:** "Connected! Claude now has access to your [Provider] account"
   - Displays: Account email, scopes granted, last updated time
   - Buttons: "Use as default", "Disconnect"

### Token Expiry / Reauthorization

1. **Chat sends message** → gets 401 Unauthorized from provider
2. **UI shows banner:** "[Provider] access expired. Reauthorize to continue."
   - Button: "Reauthorize" (re-runs oauth_start)
3. **OR:** Settings › Accounts shows provider card with red status dot + "Reauthorize" button

## Data Schema Changes

### New `oauth_config` Column (custom_toolsets table — W1 responsibility, also relevant to MCP transport)

```sql
ALTER TABLE custom_toolsets ADD COLUMN oauth_config TEXT; -- JSON, nullable
```

**Schema (within JSON):**
```typescript
interface OAuthConfig {
  provider: "anthropic" | "openai" | "google" | ...
  accountEmail?: string
  scopes: string[]
  grantedAt: string                    // ISO 8601
  expiresAt?: string                   // ISO 8601 (if expires)
  refreshUrl?: string                  // Token refresh endpoint
  quotaPercentage?: number             // 0–100
  quotaWindow?: "3h" | "6h" | "1d" | "monthly" | "pay/use"
  quotaRefreshed: string               // ISO 8601
  quotaNextReset: string               // ISO 8601
}
```

### Models Table Enhancement (if needed)

Currently `models` table stores static catalog. Add optional columns:
- `requiresAuth?: boolean` (default false for local)
- `quotaSupport?: boolean` (can we fetch quotas for this model)

## Migration & Rust Side

### Tauri Commands

1. **`oauth_start(provider: string, auth_url: string) -> ()`**
   - Opens system browser, initiates deep-link listener

2. **`secret_set(service: string, account: string, value: string) -> Result<()>`**
   - Stores value in macOS Keychain

3. **`secret_get(service: string, account: string) -> Result<string>`**
   - Retrieves from Keychain

4. **`secret_delete(service: string, account: string) -> Result<()>`**
   - Removes from Keychain

### Deep Link Handler

- Register handler for `chorus://oauth/callback`
- Parse query params, emit `oauth-callback` event to TS side
- OR: Fallback loopback listener on `http://127.0.0.1:<random_port>/callback`

### CSP Update (Tauri)

Verify `src-tauri/tauri.conf.json` allows:
- `frame-src 'self' data: https://accounts.google.com https://auth.openai.com ...` (or broader if needed for provider auth URLs)

## Deviations

| Item | Mock | Design/Spec | Resolution |
|------|------|------------|-----------|
| Quota precision | "62%", "84%" | No decimal places | OK; show as integer %. |
| Fallback model name | "GPT-5.2" hardcoded in preset | Should be configurable | Store as `quotaFallback` in cost preset; default to first non-Anthropic model. |
| OAuth library | Not specified | MCP SDK `OAuthClientProvider` | Use MCP spec implementation; vendor `@modelcontextprotocol/sdk` OAuth client. |
| Keychain integration | Native macOS only | No Windows/Linux plan yet | Document as macOS-only; Linux/Windows: use SecureStorage fallback (e.g., Tauri `tauri-plugin-kv`) or platform-specific keyring. |

---

**Implementation (W1):**
- OAuth 2.1 + PKCE flow in TS, deep-link handler in Rust
- Keychain integration for token storage
- Quota fetch on app startup + background polling
- UI: Badges in model rows, status indicators in Accounts section
- Fallback logic in Fleet/composer when quota high
