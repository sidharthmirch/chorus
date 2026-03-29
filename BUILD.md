# Building Chorus

Chorus is built using Tauri, React, TypeScript, and Rust. To build the application yourself, follow these steps.

## Prerequisites

- [Node.js](https://nodejs.org/) (version >= 22.0.0)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) and Cargo
- [Git LFS](https://git-lfs.com/)

## Installation

1. Clone the repository and navigate to the directory.
2. Initialize Git LFS:

   ```bash
   git lfs install --force
   git lfs pull
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

## Building the App

To build the production app for your platform, run:

```bash
pnpm tauri build
```

This will generate the application bundle (e.g., `.app` for macOS) in `src-tauri/target/release/bundle/`.
