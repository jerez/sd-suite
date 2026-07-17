# USB Link

USB Link lets Stream Deck control the local USB Network Gate installation on
the same machine.

## When to Use USB Link

- You want local-only USB Network Gate control on the same machine as Stream
  Deck.
- You need one of four explicit actions: share, unshare, connect, or
  disconnect.
- Device name is enough to identify the target device for each key.

## When Not to Use USB Link

- You need remote delegation across machines.
- You need host, port, or credential fields in Stream Deck settings.
- You need USB Link to guess between duplicate visible device names.

## Documentation

- [User Guide](./docs/user-guide.md)
- [Developer Guide](./docs/developer-guide.md)
- [Visual Identity](./docs/visual-identity.md)

## Commands

```sh
pnpm build
pnpm dev
pnpm validate
pnpm pack
pnpm test
```
