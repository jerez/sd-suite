# Audio Source

Audio Source is a Stream Deck+ plugin for selecting the default macOS or
Windows audio device from an encoder dial. It gives users separate actions for
output and input devices, and gives maintainers package-local commands and
guides for changing or verifying the plugin.

## Supported environment

| Component              | Minimum version                             |
| ---------------------- | ------------------------------------------- |
| Stream Deck            | 6.9                                         |
| macOS                  | 12                                          |
| Windows                | 10                                          |
| Stream Deck controller | Encoder-capable model, such as Stream Deck+ |

## Actions

| Action                    | Rotate                 | Push                                         | Touch                                           |
| ------------------------- | ---------------------- | -------------------------------------------- | ----------------------------------------------- |
| Cycle Audio Output Device | Preview output devices | Make the previewed device the system default | Show the active output device and its transport |
| Cycle Audio Input Device  | Preview input devices  | Make the previewed device the system default | Show the active input device and its transport  |

Rotation only previews a device. The operating-system default changes after a
push. An unconfirmed preview returns to the active device after 3.5 seconds.

See the [user guide](./docs/user-guide.md) for installation, interaction modes,
and troubleshooting.

## Package layout

```text
apps/audio-source/
  dev.jerez.sds.audio-source.sdPlugin/  Manifest, layouts, assets, and native bridges
  docs/                                  User, developer, and visual guides
  scripts/                               Packaged-archive validation
  src/actions/                           Stream Deck event orchestration
  src/audio/                             Platform contracts and adapters
  src/layout/                            Encoder feedback renderers
  src/shared/                            Time-based cache
  src/switching/                         Platform-independent selection logic
```

The plugin uses the platform's built-in audio APIs through packaged native
bridges. It does not require a separate audio-device utility.

## Maintainer commands

Run commands from the workspace root with the Node.js version in `.nvmrc` and
the pnpm version declared in the root `package.json`.

```bash
pnpm --filter audio-source build
pnpm --filter audio-source test
pnpm --filter audio-source typecheck
pnpm --filter audio-source lint
pnpm --filter audio-source validate
pnpm --filter audio-source run pack
```

`build` writes the plugin backend to the `.sdPlugin/bin/` directory. `validate`
checks the manifest and required source assets. `run pack` builds the plugin,
creates the `.streamDeckPlugin` installer in `apps/audio-source/`, and verifies
that the native bridge files are inside the archive.

## Maintainer guides

- [Developer guide](./docs/developer-guide.md): architecture, native protocol,
  tests, packaging, and manual verification
- [Visual identity](./docs/visual-identity.md): metaphor, palette, source assets,
  and export sizes
- [User guide](./docs/user-guide.md): the supported user workflow and support
  boundaries
