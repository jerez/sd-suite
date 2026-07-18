# Audio Source developer guide

This guide explains how maintainers can trace, test, validate, package, and
manually verify Audio Source from the `sd-suite` workspace.

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
| `src/audio/`                                   | Defines normalized contracts and selects the platform adapter.           |
| `src/shared/timed-cache.ts`                    | Caches reads and deduplicates concurrent misses.                         |
| `src/layout/`                                  | Builds SVG feedback and the four encoder display modes.                  |
| `dev.jerez.sds.audio-source.sdPlugin/native/`  | Contains the Swift and PowerShell/C# bridges shipped with the plugin.    |
| `dev.jerez.sds.audio-source.sdPlugin/layouts/` | Defines the 200 by 100 encoder feedback layout.                          |
| `scripts/validate-native-packaging.mjs`        | Checks required native files in the packed archive.                      |

## Native bridge line protocol

Both adapters accept `output` and `input` scopes and return one compact JSON
object for `query` and `set`:

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

### macOS process contract

The adapter invokes `/usr/bin/swift` with one of these argument forms:

```text
audio-bridge.swift query <output|input>
audio-bridge.swift set <output|input> <device-id>
audio-bridge.swift watch <output|input>
```

The watcher writes `ready` once and then one `changed` line for each relevant
default-device or mute event. The TypeScript adapter reacts only to `changed`.

### Windows process contract

The adapter invokes `powershell.exe` with the packaged `audio-bridge.ps1`. It
passes inputs through these environment variables:

| Variable             | Values                                 |
| -------------------- | -------------------------------------- |
| `SD_AUDIO_ACTION`    | `query`, `set`, or `watch`             |
| `SD_AUDIO_FLOW`      | `output` or `input`                    |
| `SD_AUDIO_DEVICE_ID` | Endpoint ID for `set`; empty otherwise |

The PowerShell launcher compiles the packaged C# bridge. Its watcher writes
`ready` once and then line-delimited `changed` events. A set operation updates
the console, multimedia, and communications default roles before returning the
new state.

Query and set child processes time out after 15 seconds and have a 2 MiB output
limit. Watch processes remain active while at least one corresponding dial
action is visible.

## Build and test

Use the Node.js version in the workspace `.nvmrc` and the pnpm version in the
root `package.json`. From the workspace root, run:

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

## Package and verify the archive

Run the package script from the workspace root:

```bash
pnpm --filter audio-source run pack
```

The script builds first, creates
`apps/audio-source/dev.jerez.sds.audio-source.streamDeckPlugin`, and then checks
the archive with `scripts/validate-native-packaging.mjs`. A successful final
line is:

```text
Required package assets are present.
```

The archive check requires the encoder layout plus the Swift, PowerShell, and
C# bridge files. The generated installer and `.sdPlugin/bin/` output are build
artifacts and must remain untracked.

## Manual verification on macOS

1. Pack and install the `.streamDeckPlugin` file on macOS 12 or later with
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

1. Pack and install the `.streamDeckPlugin` file on Windows 10 or later with
   Stream Deck 6.9 or later.
2. Repeat the rotate, push, touch, external-change, and timeout checks from the
   macOS procedure for both actions.
3. After pushing, confirm in Windows sound settings that the selected endpoint
   is the default. Test an input and an output endpoint.
4. Restart Stream Deck and confirm that both actions load without a bridge-file
   or PowerShell compilation error.

Manual platform verification is required because unit tests mock the platform
contract and cannot exercise CoreAudio, Windows Core Audio COM, hardware event
delivery, or Stream Deck installation.
