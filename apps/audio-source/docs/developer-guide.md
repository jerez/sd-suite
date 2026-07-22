# Audio Source developer guide

This guide explains how Audio Source maintainers can trace the runtime, verify
native bridges, develop locally, and publish a cross-platform plugin from the
`sd-suite` workspace.

## Runtime data flow

1. An action in `src/actions/` receives appear, rotate, push, touch, disappear,
   and native-change events from the Stream Deck SDK.
2. The shared `DeviceSwitcher` in `src/switching/` owns per-action pending
   selections. Rotation previews an ID. Push applies the pending ID.
3. The action reads device lists and defaults through two 60-second
   `TimedCache` instances. The `AudioDeviceApi` contract normalizes device IDs,
   names, form factor, transport, disabled state, and mute state.
4. `src/audio/index.ts` chooses the macOS or Windows adapter at startup. The
   adapter runs the packaged native bridge for the requested input or output
   scope.
5. The native bridge queries or updates the operating-system default endpoint
   and emits normalized state. A long-running watcher emits change events.
6. The action invalidates caches after writes, watcher events, and transient
   mode timeouts. It sends normalized device data to the renderer in
   `src/layout/`.
7. The renderer updates the custom encoder layout for idle, browse, confirm, or
   details mode.

The switching layer has no operating-system branching. Platform-specific code
stays behind `AudioDeviceApi`.

## Source layout

| Path                                           | Responsibility                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `src/plugin.ts`                                | Registers both actions and connects to Stream Deck.                      |
| `src/actions/`                                 | Coordinates SDK events, caches, switching, subscriptions, and rendering. |
| `src/switching/`                               | Computes wrapped previews and confirms per-action selections.            |
| `src/audio/`                                   | Defines normalized contracts and resolves the platform bridge.           |
| `src/shared/timed-cache.ts`                    | Caches reads and deduplicates concurrent misses.                         |
| `src/layout/`                                  | Builds SVG feedback and the four encoder display modes.                  |
| `native/macos/`                                | Defines the macOS SwiftPM executable.                                    |
| `native/windows/`                              | Defines the Windows x64 `net472` executable.                             |
| `.native/`                                     | Holds ignored native build output.                                       |
| `dev.jerez.sds.audio-source.sdPlugin/native/`  | Holds staged development files or compiled release binaries.             |
| `dev.jerez.sds.audio-source.sdPlugin/layouts/` | Defines the 200 by 100 encoder feedback layout.                          |
| `scripts/`                                     | Builds, tests, stages, cleans, and validates native artifacts.           |

## Production native bridges

The installed plugin contains one compiled bridge for each supported platform:

| Platform | Installed path                    | Build target                                       |
| -------- | --------------------------------- | -------------------------------------------------- |
| macOS    | `native/macos/audio-bridge`       | SwiftPM, macOS 12 or later, universal x86_64/arm64 |
| Windows  | `native/windows/audio-bridge.exe` | x64 .NET Framework 4.7.2 (`net472`)                |

The macOS executable calls CoreAudio. The Windows executable calls Windows Core
Audio COM and sets the console, multimedia, and communications default roles.
The Windows bridge requires 64-bit Windows 10 or later and .NET Framework 4.7.2
or later on the host. The Windows release does not bundle a .NET runtime. See
Microsoft's [.NET Framework system requirements](https://learn.microsoft.com/en-us/dotnet/framework/get-started/system-requirements)
for supported host details.

Production resolution requires the compiled executable for the current
platform. A missing executable produces `Compiled macOS audio bridge not found.`
or `Compiled Windows audio bridge not found.`. The runtime never selects source
code as an automatic fallback.

## Native bridge process protocol

Both compiled executables accept positional arguments:

```text
audio-bridge query <output|input>
audio-bridge set <output|input> <device-id>
audio-bridge watch <output|input>
```

`query` and `set` write one compact JSON object:

```json
{
    "devices": [
        {
            "id": "platform-id",
            "name": "Device name",
            "formFactor": "speakers",
            "transportType": "usb",
            "isDisabled": false,
            "isMuted": false
        }
    ],
    "defaultId": "platform-id"
}
```

Fields after `name` can be unavailable. The TypeScript parser keeps valid
string `id` and `name` pairs, treats a missing default ID as `null`, and ignores
earlier output lines by parsing the last non-empty line.

`watch` writes `ready` after registering listeners, followed by one
line-delimited `changed` message for each relevant device event. The TypeScript
adapter does not complete the subscription until it receives `ready`. A launch
error, early exit, or 10-second startup timeout rejects the subscription with
bounded standard-error context. After startup, the adapter reacts only to
`changed` and logs an unexpected bridge exit.

Query and set child processes time out after 15 seconds and have a 2 MiB output
limit. Watch processes remain active while at least one corresponding dial
action is visible.

## Build and test the current platform

Use the Node.js version in the workspace `.nvmrc` and the pnpm version in the
root `package.json`. Run the plugin checks from the workspace root:

```bash
pnpm --filter audio-source build
pnpm --filter audio-source test
pnpm --filter audio-source typecheck
pnpm --filter audio-source lint
pnpm --filter audio-source validate
```

The Vitest suite covers manifest compatibility, package assets, the timed
cache, switcher behavior, device icons, and input/output dial renderers.
`validate` runs the Elgato manifest validator and the focused manifest and asset
tests.

Compile and exercise the native bridge for the current host platform:

```bash
pnpm native:build --filter=audio-source
pnpm --filter audio-source native:validate
pnpm --filter audio-source native:test
```

The root `native:build` Turbo task is the shared current-platform entry point
used for explicit local builds and package assembly. These commands write
ignored output under `.native/`, validate its executable format, and run the
compiled `self-test output` protocol. On macOS, the local build contains the
current architecture. The release build is the only command that combines
x86_64 and arm64 into one executable. The Windows self-test also checks the
compiled COM metadata used by the bridge, including native method order and
preserved HRESULT signatures.

## Stage interpreted development mode

Local Stream Deck development can explicitly stage source for the current
platform:

```bash
pnpm --filter audio-source native:stage:development
```

The command writes the platform name to
`dev.jerez.sds.audio-source.sdPlugin/native/.development-mode` and stages only
the corresponding source. macOS uses `/usr/bin/swift`. Windows uses the staged
PowerShell launcher to compile the staged C# source for development only.

The marker is an explicit mode switch. If its value does not match the running
platform, startup fails. Without the marker, the runtime requires the compiled
installed executable and does not fall back to source.

Remove all staged native development files before production validation:

```bash
pnpm --filter audio-source native:clean
```

## CI and CodeQL responsibilities

Normal CI verifies non-draft pull requests and pushes without compiling native
executables or producing release artifacts:

- The Linux job runs formatting, linting, type checking, tests, and plugin
  validation.
- The test suite validates native source and packaging contracts without
  invoking a native compiler.
- No normal CI job compiles or stages package binaries, uploads native
  artifacts, creates an installer, or publishes a release.

Pull requests that change shipped Audio Source behavior include an `audio-source`
Changeset. A reviewed version pull request synchronizes the package version and
four-part Stream Deck manifest version. Merging that version pull request causes
the shared release workflow to select Audio Source.

The advanced CodeQL workflow analyzes JavaScript/TypeScript and C# without a
build. It does not compile or analyze Swift in pull requests.

## Assemble a cross-platform package

Package assembly requires native executables compiled on their matching host
platforms. Place the completed outputs at these ignored package-local paths:

```text
.native/macos/audio-bridge
.native/windows/audio-bridge.exe
```

The macOS executable must be a macOS 12 universal `arm64` and `x86_64` binary.
The package-owned release task builds and validates it on macOS:

```bash
pnpm turbo run release:native --filter=audio-source
```

The same task builds, validates, and exercises the x64 `net472` executable on
Windows. It also runs the Windows query and watcher integration smoke test:

```bash
pnpm turbo run release:native --filter=audio-source
```

After both executables are present, stage them and create the installer:

```bash
pnpm --filter audio-source native:stage
pnpm --filter audio-source run pack
```

The installer contains both compiled paths:

```text
native/macos/audio-bridge
native/windows/audio-bridge.exe
```

The staging and archive validators reject native source, development markers,
and compiler intermediates. The installer must not contain
`native/.development-mode` or files ending in `.swift`, `.cs`, `.ps1`,
`.csproj`, or `.pdb`. Native sources stay under `native/`; generated binaries,
Swift scratch directories, staged native files, and installers remain ignored.

A successful archive check ends with:

```text
Required compiled native package assets are present.
```

These package commands do not create tags or upload artifacts. The shared
release workflow transfers `.native/macos/` and `.native/windows/` between jobs,
runs the staging and packaging tasks, and attaches the installer to the
`audio-source@<version>` GitHub Release. Generated native executables and
installers remain ignored and must not be committed.

## Manual verification on macOS

1. Install the assembled `.streamDeckPlugin` file on macOS 12 or later with
   Stream Deck 6.9 or later.
2. Add both actions to separate encoder dials.
3. For each action, rotate in both directions. Confirm that the carousel wraps
   and that the system default has not changed.
4. Push a preview. Confirm in macOS settings that the matching input or output
   is now the default.
5. Touch the dial. Confirm that details show the active device and its reported
   transport.
6. Change the default in macOS settings. Confirm that an idle dial updates.
7. Leave a preview untouched. Confirm that it reverts after about 3.5 seconds.

## Manual verification on Windows

1. Install the assembled `.streamDeckPlugin` file on 64-bit Windows 10 or later
   with .NET Framework 4.7.2 or later and Stream Deck 6.9 or later.
2. Repeat the rotate, push, touch, external-change, and timeout checks from the
   macOS procedure for both actions.
3. After pushing, confirm in Windows sound settings that the selected endpoint
   is the default. Test an input and an output endpoint.
4. Restart Stream Deck and confirm that both actions load without a native
   bridge launch error.

Manual platform verification is required because unit tests mock the platform
contract and cannot exercise CoreAudio, Windows Core Audio COM, hardware event
delivery, or Stream Deck installation.
