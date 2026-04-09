# Changelog

## v0.14.15

Released 2026-04-09

### Features

-   Per-tool and per-project YOLO mode for granular auto-accept permissions
-   OpenRouter actual model attribution and cost tracking in streaming responses
-   Multiple sub-provider filter selection in model search
-   Collapsible chat input for long text

### Improvements

-   Improved fuzzy search with scored substring matching and provider filtering
-   Better autorouter/freerouter labels and free-tier display names
-   Selected provider chips stay visible during search

### Fixes

-   Fix YOLO deny precedence and memoize permission tool list
-   Fix MCP terminal startup
-   Fix model_config UUID passed when replying to single model
-   Migration 145 legacy compatibility for dev instances

## v0.14.14

Released 2026-04-07

-   **Fix profile model selection fallback** - profile model selection now falls back correctly instead of leaving compare state in a bad state.
-   **Fix cmd+number keyboard navigation** - selected blocks and columns now scroll into view when using cmd+number.
-   **Fix cmd+number toggle-off behavior** - reselecting the same block with cmd+number now deselects it as expected.

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper. Alternatively, run:
>
> ```
> xattr -d com.apple.quarantine /Applications/Chorus.app
> ```

## 0.14.6-PRE (pre-release)

Released 2026-04-08

This is a testing build which should have the same feature-set as v0.14.14. Intended use is for proof-of-concept for merging with base fork meltylabs/chorus

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper. Alternatively, run:
>
> ```
> xattr -d com.apple.quarantine /Applications/Chorus.app
> ```

## v0.14.13

Released 2026-03-31

-   **Deselect model block when clicking outside or re-clicking** — exit the model block reorder mode by clicking anywhere outside or re-clicking the selected block
-   **Fix sidepane blur on reply messages** — reply messages in the sidepane no longer have the blur effect incorrectly applied
-   **Fix cmd+number keybindings** — cmd+1-8 now works for both tools and compare blocks; cmd+1 always selects the leftmost column; cmd/ctrl+shift+space scrolls the selected column into view

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper. Alternatively, run:
>
> ```
> xattr -d com.apple.quarantine /Applications/Chorus.app
> ```

## v0.14.12

Released 2026-03-31

### New Features

-   **Defaults settings tab** — New Settings → Defaults section consolidates new-chat preferences: default prompt profile, default chat models (multi-model), fallback model (with optional model profile constraint), and default ambient chat model. Replaces the former separate Ambient Chat tab controls.

-   **Per-chat model selection persistence** — Selected models are now saved per chat. Switching chats and returning preserves your model selection. New chats are initialized from your Default Chat Models setting, falling back to the ambient compare list.

-   **Per-project default prompt profile** — Each project can now have its own default prompt profile (set in the project view), which overrides the global default when creating new chats in that project.

-   **Fresh-install model preferences** — On first launch, Gemini 2.5 Flash Lite is seeded as the default ambient, fallback, and chat model.

### Downloads

-   **Apple Silicon (M1/M2/M3):** \`Chorus-aarch64.app.zip\` or \`Chorus-aarch64.dmg\`
-   **Intel:** \`Chorus-x86_64.app.zip\` or \`Chorus-x86_64.dmg\`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.

## v0.14.11

Released 2026-03-31

-   Initial implementation of reorder chat functionality

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.

## v0.14.10

Released 2026-03-30

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.

## v0.14.9

Released 2026-03-30

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.

## v0.14.8

Released 2026-03-30

-   **Multi-Model Column Minimization**: Added a minimize button to each model column in the multi-model view to help manage your workspace.

-   **Automated Minimization**: Models that fail to return a response after stopping will now automatically minimize to reduce clutter.

-   **Sidebar Integration**: Minimized models are easily accessible in the sidebar above Projects, where they can be clicked to quickly restore the column.

-   **Smart Message Sending**: Minimized models are automatically excluded from new message sends until you expand them again.

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.
> Alternatively, remove the quarantine flag via Terminal: `xattr -d com.apple.quarantine Chorus.app`

## v0.14.7

Released 2026-03-29

-   Add support for ⌘ Command + ⇧ Shift + A to select all models in a profile

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.

## v0.14.6

Released 2026-03-29

-   Update Ambient chat model to use Gemini 2.5 flash

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.

## v0.14.5

Released 2026-03-29

-   Added profiles for favorite models in the chat window
-   Dynamically fetch and select models from providers
-   Prompt profiles

### Downloads

-   **Apple Silicon (M1/M2/M3):** `Chorus-aarch64.app.zip` or `Chorus-aarch64.dmg`
-   **Intel:** `Chorus-x86_64.app.zip` or `Chorus-x86_64.dmg`

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.
