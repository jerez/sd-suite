# USB Link Developer Guide

## Boundary

USB Link is local-only. Every action runs on the same machine as Stream Deck and only controls the local USB Network Gate client or app on that machine.

Out of scope:

- Control Mesh delegation
- remote credential storage
- hostname or port fields in button settings

## Shared Core

The shared execution core handles:

- settings validation
- stable device ID matching with legacy name fallback
- operation routing
- stable user-facing error messages
- Stream Deck feedback logging

Settings shape stays minimal:

```ts
type DeviceActionSettings = {
    deviceId?: string;
    deviceName?: string;
};
```

New property-inspector selections persist the USB Network Gate device ID and
visible label. Name-only settings from version 0.1 remain compatible. For those
legacy settings, matching stays strict:

- exact trimmed match first
- case-insensitive exact fallback only
- duplicate visible names fail explicitly

## macOS Adapter

macOS uses the installed `eveusbc` CLI and USB Network Gate's AppleScript API:

- local enumeration: `eveusbc ls local`
- shared enumeration: `eveusbc ls shared`
- remote enumeration: `eveusbc ls net`
- share: AppleScript `share` matched by the selected device ID
- unshare: `eveusbc unshare <device-id>`
- connect: `eveusbc connect <host:port>`
- disconnect: `eveusbc disconnect <host:port>`

The share adapter lets USB Network Gate choose its configured/default TCP port.
Selected devices execute directly from their saved ID and name; the action must
not query `eveusbc` immediately before or after sharing:
USB Network Gate 11's kextless macOS mode tears down an active share when the
CLI process exits.

The AppleScript process remains alive for three seconds after `share`. USB
Network Gate 11 otherwise destroys the kextless share when the automation
client exits before initialization settles.

## Windows Adapter

Windows uses the installed USB Network Gate client CLI:

- binary: `UsbService64.exe`
- local enumeration: `show-usb-list`
- shared enumeration: `show-shared-usb`
- remote base list: `show-remote-devices`
- remote name refresh: `find-remote-devices <server>`
- share: `share-usb-port <usb-port>`
- unshare: `unshare-usb-port <usb-port>`
- connect: `connect-remote-device <tcp>`
- disconnect: `disconnect-remote-device <tcp>`

Important runtime caveat:

- the Windows client can return useful output with a non-zero exit code
- adapter logic treats `Error:` lines in command output as failure instead of trusting the exit code alone

Remote connect and disconnect stay local-service only. The adapter enriches already-known remote endpoints with `find-remote-devices <server>` so the property inspector can show names when the base list would otherwise show `Unknown`.
