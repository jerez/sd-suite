# USB Link User Guide

USB Link runs on the same machine as Stream Deck and only controls the local
USB Network Gate installation on that machine.

## Requirements

- Stream Deck 7.1 or newer
- USB Network Gate installed locally
- Target devices already visible to the local USB Network Gate instance

## Configure a USB Link Key

1. Drag one of the four USB Link actions to a Stream Deck key.
2. Open the property inspector for that action. For Connect Device or
   Disconnect Device, enter the remote server hostname or IP address.
3. Select the device from the property inspector. The device list refreshes when
   the server setting changes; use the refresh button if the USB Network Gate
   device list changes afterward.
4. Press the key to test the action.

USB Link stores the selected USB Network Gate device ID and its visible name in
Stream Deck settings. Remote actions also store the server address used for
discovery. USB Link does not store credentials or expose per-device port fields.

## Actions

| Action            | Matches against                                                       | Result                                                               |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Share Device      | Local physically attached USB devices                                 | Shares the matched device through the local USB Network Gate service |
| Unshare Device    | Local shared USB devices                                              | Stops sharing the matched device                                     |
| Connect Device    | Remote devices visible to the local machine and not already connected | Connects the matched remote device locally                           |
| Disconnect Device | Remote devices visible to the local machine and already connected     | Disconnects the matched remote device locally                        |

## How Device Selection Works

Newly configured keys execute against the selected device's stable ID, so two
devices with the same visible name remain distinct. Existing keys configured by
name continue to work with the previous matching rules:

1. Exact match after trimming surrounding whitespace.
2. Case-insensitive exact match after trimming surrounding whitespace.

If no legacy name matches, the action fails. If more than one device matches,
the action also fails. Re-select the device to save its stable ID.

## Key Feedback

When you press a USB Link key, the plugin shows:

- an active image while the action is running
- a success image and Stream Deck OK feedback on success
- an error image and Stream Deck alert feedback on failure

Success and error images return to the default key image after a short dwell
window.

## Platform Notes

- macOS refreshes the remote server with `eveusbc explore <server>`, then reads
  the resulting `eveusbc ls net` list.
- Windows uses the installed USB Network Gate client CLI.
- On Windows, a configured server is queried with
  `find-remote-devices <server>`; without one, only devices already added to the
  local USB Network Gate client are available.

## Troubleshooting

### USB Network Gate is not available on this machine

Check that USB Network Gate is installed locally on the same machine as Stream
Deck.

### No USB device was found

Refresh the selector and check that the device is visible in the local USB
Network Gate app or client. Re-select it if the saved USB port or remote
endpoint changed.

### Multiple USB devices named "..."

Use a visible device name that is unique in the local USB Network Gate app or
client. USB Link will not guess between duplicate names.
