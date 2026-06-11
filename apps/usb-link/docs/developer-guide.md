# USB Link Developer Guide

## Boundary

USB Link is local-only. Every action runs on the same machine as Stream Deck and only controls the local USB Network Gate client or app on that machine.

No Control Mesh delegation. No EPPC. No remote credential storage. No hostname or port fields in button settings.

## Shared Core

The shared execution core handles:

- settings validation
- strict name matching
- operation routing
- stable user-facing error messages
- Stream Deck feedback logging

Settings shape stays minimal:

```ts
type DeviceActionSettings = {
    deviceName?: string;
};
```

Matching stays strict:

- exact trimmed match first
- case-insensitive exact fallback only
- duplicate visible names fail explicitly

## macOS Adapter

macOS uses two local surfaces:

- enumeration: `eveusbc ls local` and `eveusbc ls net`
- execution: AppleScript against `USB Network Gate`

Share and unshare target:

- `first device whose name is "..."`

Connect and disconnect target:

- `first remote device whose name is "..."`

## Windows Adapter

Windows uses the installed USB Network Gate client CLI:

- binary: `UsbService64.exe`
- local enumeration: `show-usb-list`
- remote base list: `show-remote-devices`
- remote name refresh: `find-remote-devices <server>`
- share: `share-usb-port <usb-port>`
- unshare: `unshare-usb-port <usb-port>`
- connect: `connect-remote-device <tcp>`
- disconnect: `disconnect-remote-device <tcp>`

Important runtime caveat:

- the Windows client can return useful output with a non-zero exit code
- adapter logic treats `Error:` lines in command output as failure instead of trusting the exit code alone

Remote connect and disconnect stay local-service only. The adapter enriches already-known remote endpoints with `find-remote-devices <server>` so device-name-only matching still works when the base list would otherwise show `Unknown`.
