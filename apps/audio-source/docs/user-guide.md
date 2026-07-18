# Audio Source user guide

Use Audio Source on an encoder-capable Stream Deck to preview and select the
default audio output or input device without opening system settings.

## Requirements

- Stream Deck 6.9 or later
- macOS 12 or later, or Windows 10 or later
- An encoder-capable Stream Deck, such as Stream Deck+
- At least one audio endpoint recognized by the operating system

Audio Source runs a packaged Swift bridge on macOS and packaged PowerShell and
C# bridge files on Windows. Do not move or delete files inside the installed
plugin directory. No separate audio switching utility is required.

## Install the packed plugin

1. Obtain the `dev.jerez.sds.audio-source.streamDeckPlugin` file produced by the
   package command.
2. Open the file with Stream Deck.
3. Approve the installation when Stream Deck prompts you.
4. Open the Stream Deck action list and find the **audio-source** category.

## Add an encoder action

Drag either action onto an encoder dial:

- **Cycle Audio Output Device** controls the system default playback device.
- **Cycle Audio Input Device** controls the system default recording device.

You can add both actions to separate dials. Each action tracks its own pending
selection.

## Use the dial

| Gesture | Result                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Rotate  | Enters browse mode and previews devices in a wrapping carousel. Rotation does not change the system default. |
| Push    | Confirms the previewed device and makes it the default. Pushing without a preview keeps the current default. |
| Touch   | Cancels an unconfirmed preview and shows details for the active device.                                      |

If you stop rotating without pushing, browse mode closes after 3.5 seconds and
the dial returns to the active device. The confirmation display lasts about
0.75 seconds. The details display lasts 3.5 seconds.

## Understand the display

- **Idle:** shows the active device icon and name.
- **Browse:** shows the previous, selected, and next devices plus the selected
  device name.
- **Confirm:** shows a check mark and the confirmed device name.
- **Details:** shows the connection type, when the operating system reports it,
  and the active device name.

The device icon can also reflect muted or disabled state when the platform
bridge provides that information. Changes made in system settings update idle
dials through a native device-change watcher.

## Troubleshooting

| Symptom                                    | Check                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| The action is missing                      | Confirm that Stream Deck is 6.9 or later and that you are assigning it to an encoder, not a key.                                   |
| The dial shows `No Output` or `No Input`   | Confirm that the operating system detects an endpoint for that direction. Reconnect or enable the device, then re-open the action. |
| A push does not select the expected device | Rotate until the expected name is centered, then push before the 3.5-second preview timeout.                                       |
| The dial shows `Error`                     | Restart Stream Deck once. If the error remains, reinstall the packed plugin so its native bridge files are restored.               |
| External device changes do not appear      | Confirm the device changed in operating-system settings, then remove and re-add the action to restart its native watcher.          |

Audio Source only changes the operating-system default input or output endpoint.
It does not control per-application routing, volume, mute state, device drivers,
Bluetooth pairing, or whether an application follows a new system default.
