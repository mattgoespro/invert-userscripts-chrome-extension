# Example userscript export

Run `pnpm export:examples` to generate `temp/example-userscripts.json`, then
import that file with the Import button in the User JavaScript and CSS extension,
choosing to merge it with your existing rules. Replacing instead deletes every
rule that isn't in the file.
To choose a different destination, run `pnpm export:examples <output.json>`.

The exporter reads `examples/userscripts/` and writes the extension's backup
format (version 11). Plain `.ts` files are compiled to JavaScript, and a `.scss`
file with the same name supplies the rule's SCSS and compiled CSS. Declaration
files are not exported because the extension has no types.

Rules use their filename stem as the name and a stable `r:example-<stem>` ID, so
importing again updates them without touching your other rules. They start
disabled with no URL patterns, so set the target pages before enabling injection.
Flags and dependencies come from `RULE_SETTINGS` in the exporter; add an entry
there when a new example needs more than the `shared` flag. The file has no
library content or settings. As of version 4.3.0, the extension downloads a
library with no stored content when its service worker starts, and a rule that
needs the library runs without it until then. If a library is new to your
install, check that it has downloaded before relying on the rule.

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
