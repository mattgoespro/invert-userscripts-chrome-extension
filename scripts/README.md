# Example userscript export

Run `pnpm export:examples` to generate `temp/example-userscripts.json`, then
select that file in the options page's **Import Userscripts** dialog.
To choose a different destination, run `pnpm export:examples <output.json>`.

The exporter reads `examples/userscripts/` and uses the options page's transfer
format and validator. Plain `.ts` files become TypeScript sources. Matching
`.d.ts` and `.global.d.ts` files populate the type declarations pane. Declaration
files without a matching source (such as `modules.d.ts`) become entries with
an empty source, so every declaration file is preserved.

Entries use their filename stem as the name and shared module name. They start
disabled with no URL patterns; configure their dependencies and target pages
before enabling injection. SCSS and global module imports start empty.

## Refactor validation and recovery

Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm exec tsc -p tsconfig.tools.json --noEmit`, and `pnpm lint` before building. The build/dev scripts configure the TypeScript Webpack loader automatically:

```powershell
pnpm build
pnpm check:manifest
pnpm e2e:headless
```

Shared Drive identity is in [config/google-drive.json](../config/google-drive.json).
Its public key and extension ID are included; fill only `clientId` to enable OAuth.
See [configuration instructions](../config/README.md).

The unpacked build requires Chrome 135+ and enabled User Scripts access. Local document storage and verified sync are separate Settings activations. Recovery snapshots include importer-compatible saved source plus supplemental legacy/draft/module/settings data. See [delivery evidence and recovery procedure](../docs/architecture/refactor-validation.md). Protocol simulation in disposable browsers does not replace signed-in Chrome Sync release acceptance.
