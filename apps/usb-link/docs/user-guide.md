# USB Link User Guide

USB Link runs on the same machine as Stream Deck and only controls the local
USB Network Gate installation on that machine.

## Requirements

- Stream Deck 7.1 or newer
- USB Network Gate installed locally
- Target devices already visible to the local USB Network Gate instance
- One visible device name per action target. USB Link does not guess between
  duplicates.

## Configure a USB Link Key

1. Drag one of the four USB Link actions to a Stream Deck key.
2. Open the property inspector for that action.
3. Enter the device name exactly as it appears in the local USB Network Gate
   app or client.
4. Press the key to test the action.

USB Link only stores the device name in Stream Deck settings. It does not store
hostnames, ports, or credentials.

## Actions

| Action            | Matches against                                                       | Result                                                               |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Share Device      | Local physically attached USB devices                                 | Shares the matched device through the local USB Network Gate service |
| Unshare Device    | Local shared USB devices                                              | Stops sharing the matched device                                     |
| Connect Device    | Remote devices visible to the local machine and not already connected | Connects the matched remote device locally                           |
| Disconnect Device | Remote devices visible to the local machine and already connected     | Disconnects the matched remote device locally                        |

## How Device Matching Works

USB Link resolves a device name in this order:

1. Exact match after trimming surrounding whitespace.
2. Case-insensitive exact match after trimming surrounding whitespace.

If no device matches, the action fails. If more than one device matches, the
action also fails. USB Link never guesses between duplicate names.

## Key Feedback

When you press a USB Link key, the plugin shows:

- an active image while the action is running
- a success image and Stream Deck OK feedback on success
- an error image and Stream Deck alert feedback on failure

Success and error images return to the default key image after a short dwell
window.

## Platform Notes

- macOS uses local CLI enumeration plus AppleScript execution against the local
  USB Network Gate app.
- Windows uses the installed USB Network Gate client CLI.
- On Windows, remote connect and disconnect act on remote devices already known
  to the local USB Network Gate client.

## Troubleshooting

### USB Network Gate is not available on this machine

Check that USB Network Gate is installed locally on the same machine as Stream
Deck.

### No USB device named "..."

Check that the device is visible in the local USB Network Gate app or client
and that the configured device name matches the visible name.

### Multiple USB devices named "..."

Use a visible device name that is unique in the local USB Network Gate app or
client. USB Link will not guess between duplicate names.
