# Audio Source

Audio Source is a Stream Deck+ plugin for selecting the default macOS or
Windows audio device from an encoder dial. It gives users separate actions for
output and input devices, and gives maintainers package-local commands and
guides for changing or verifying the plugin.

## Migration provenance

Audio Source was migrated from the standalone
[`jerez/audio-source`](https://github.com/jerez/audio-source) repository. This
package is now the maintained source for the plugin.

The migration intentionally changed the plugin UUID from
`dev.jerez.audio-source` to `dev.jerez.sds.audio-source`.

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
  native/macos/                         SwiftPM bridge source
  native/windows/                       .NET Framework bridge source
  .native/                              Ignored local and release build output
  dev.jerez.sds.audio-source.sdPlugin/  Plugin assets and staged release binaries
  scripts/                              Native build, staging, and package validation
  docs/                                 User, developer, and visual guides
  src/                                  Plugin runtime, platform adapters, and tests
```

Installed plugins run `native/macos/audio-bridge` on macOS or
`native/windows/audio-bridge.exe` on Windows. These compiled bridges use the
platform's built-in audio APIs. They do not require a separate audio-device
utility.

Normal CI has dedicated macOS and Windows jobs that build, validate, and test
the corresponding bridge. It does not stage binaries, create an installer, or
upload native artifacts. The explicit Audio Source release workflow builds
both platforms and assembles the complete cross-platform installer.

## Maintainer commands

Run commands from the workspace root with the Node.js version in `.nvmrc` and
the pnpm version declared in the root `package.json`.

```bash
pnpm --filter audio-source build
pnpm --filter audio-source test
pnpm --filter audio-source typecheck
pnpm --filter audio-source lint
pnpm --filter audio-source validate
```

`build` writes the plugin backend to the `.sdPlugin/bin/` directory. `validate`
checks the manifest, required project sources, and production package boundary.

Use these commands on macOS or Windows to compile and verify the native bridge
for the current platform:

```bash
pnpm --filter audio-source native:build
pnpm --filter audio-source native:validate
pnpm --filter audio-source native:test
pnpm --filter audio-source native:stage:development
```

`native:stage:development` explicitly stages interpreted source for local
Stream Deck development and writes `native/.development-mode`. Production does
not fall back to interpreted source when a compiled bridge is missing. Run
`pnpm --filter audio-source native:clean` to remove staged development files.

See the developer guide for the native command protocol, CI boundary, and
`audio-source-v<version>` release process.

## Maintainer guides

- [Developer guide](./docs/developer-guide.md): architecture, native protocol,
  tests, packaging, and manual verification
- [Visual identity](./docs/visual-identity.md): metaphor, palette, source assets,
  and export sizes
- [User guide](./docs/user-guide.md): the supported user workflow and support
  boundaries
