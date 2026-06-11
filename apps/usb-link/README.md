# USB Link

USB Link is a private Stream Deck plugin for local-only USB Network Gate control.

Scope:

- same machine as Stream Deck
- four explicit actions: share, unshare, connect, disconnect
- device name is the only per-button setting

Out of scope:

- remote delegation
- Control Mesh routing
- host or port configuration in button settings
- secret storage in the plugin

## Package Layout

- runtime and tests: `src/`
- Stream Deck bundle: `dev.jerez.sds.usb-link.sdPlugin/`
- user docs: `docs/user-guide.md`
- developer docs: `docs/developer-guide.md`

## Commands

```sh
pnpm build
pnpm dev
pnpm validate
pnpm pack
pnpm test
```

## Platform Strategy

- macOS: CLI enumeration plus AppleScript execution
- Windows: installed client CLI enumeration and execution

## Notes

- Matching is strict by device name.
- Ambiguous duplicate names fail instead of guessing.
- Windows remote connect and disconnect operate on remote devices already known to the local client.
