<p align="center">
  <img src="app-icon.png" alt="Chorus icon" width="128" />
</p>

<h1 align="center"><a href="https://chorus.sh">Chorus</a></h1>

<p align="center">All the AI, on your Mac. Built by the creators of <a href="https://conductor.build">Conductor.</a></p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/771262eb-5a0e-40cb-b1a5-9df6b903c626" alt="Chorus screenshot" />
</p>

# Fork changes

-   Added profiles for favorite models in the chat window
-   Dynamically fetch and select models from providers
-   Prompt profiles: Choose your preferred chat persona
-   Minimize model columns in multi-model chat with sidebar management and auto-minimize on empty responses
-   Move model responses around in their row, changing the order they are displayed to you in
-   Ability to customize default models (multi-model chat and ambient chat)
-   Set app and project specific default prompt profiles

> **Note:** This app is not code-signed. On first launch, right-click the app and select "Open" to bypass Gatekeeper.
> Alternatively, remove the quarantine flag via Terminal: `xattr -d com.apple.quarantine Chorus.app`

# Getting Started

You will need:

1. NodeJS installed and on your path
2. Rust and Cargo installed and on your path (verify with `rustc --version`, `cargo --version`)
3. `imagemagick` (optional)
4. `git-lfs` (`brew install git-lfs`)
5. `pnpm` (`brew install pnpm`)

Once you have those set up, please run:

```bash
git lfs install --force
git lfs pull
pnpm run setup  # This is also our Conductor setup script
pnpm run dev    # This is also our Conductor run script
```

# Building Chorus

To build Chorus from source, please refer to the [BUILD.md](BUILD.md) file.

# Nightly Build

You can download the [nightly build here](https://cdn.crabnebula.app/download/chorus/chorus/latest/platform/dmg-aarch64?channel=qa). Every push to main triggers a new build.
