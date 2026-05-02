---
name: "Webpack Build Conventions"
applyTo: "webpack.config.ts"
description: "Use when editing webpack.config.ts for the Chrome extension build: entry coordination, tsconfig loader routing, Monaco bundling, copied assets, and dev reloader exclusions."
---

# Webpack Build Conventions

Instructions when editing webpack.config.ts for the Chrome extension build: entry coordination, tsconfig loader routing, Monaco bundling, copied assets, and dev reloader exclusions.

Treat `webpack.config.ts` as one coordinated extension build definition rather than a set of isolated knobs.

- New or renamed entry points usually require matching changes in `entry`, `HtmlWebpackPlugin`, copied assets, and any manifest/runtime references.
- Keep the per-package `esbuild-loader` routing aligned with each package's tsconfig. Renderer JSX handling and package path aliases depend on that split.
- The extension currently builds `background`, `popup`, `options`, and `sass-sandbox` as separate outputs. Removing or renaming one requires coordinated updates beyond the entry block.
- Monaco bundling depends on both `MonacoEditorWebpackPlugin` wiring and the root `monaco-editor` package path. Do not assume `monaco-editor-core` alone is enough.
- `CopyWebpackPlugin` rewrites `public/manifest.json` and copies `sass-sandbox.html`; if those paths move, update both the copy step and the runtime URLs that load them.
- The development reloader intentionally excludes `sass-sandbox.html` and `popup.html`. Preserve or change those exclusions intentionally rather than as a side effect of other edits.
