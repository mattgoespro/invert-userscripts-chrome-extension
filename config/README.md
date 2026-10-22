# Shared Google Drive configuration

`google-drive.json` contains Invert's public application identity. The existing
public key is included and derives extension ID
`odebcojfkjmpakmhhihdddfaodkohcfp`. Keep `publicKey` and `extensionId` unchanged
across clones and reinstalls.

The only value to supply is **`clientId`**: the full Chrome Extension OAuth client
ID ending in `.apps.googleusercontent.com`. Register that client once for the
extension ID above in the publisher's Google Cloud project, enable the Drive API
and authorize the `https://www.googleapis.com/auth/drive.appdata` scope. Use the
appropriate OAuth audience/test-user configuration. A local unpacked extension
does not require a Chrome Web Store listing.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm check:manifest
```

The build handles the TypeScript Webpack loader automatically. No OAuth
environment variables or ignored key files are needed; former
`INVERT_GOOGLE_CLIENT_ID` / `INVERT_EXTENSION_PUBLIC_KEY` variables are ignored.
Restart the build/watch process after changing this configuration.

With `clientId` empty, the extension still builds and loads with the stable ID,
but reports **OAuth setup required**. Filling in the client ID and rebuilding
enables the existing Drive connection/restoration flow. Invalid configuration
or a key/ID mismatch fails the build instead of silently changing identity.

Load the checkout's `dist/` in `chrome://extensions` and confirm the ID above.
If replacing an existing installation with a different path-derived ID, export
its scripts/recovery snapshot before removing it. On a new account or machine,
Google may require a Connect/Reconnect action before restoration; silent
authorization is attempted automatically.

The public key and client identifier are distribution configuration. Never add
user tokens, OAuth client secrets or private signing keys to this file. Preserve
these source/configuration changes in Git before deleting the checkout; a fresh
clone only contains files present in the repository history.
