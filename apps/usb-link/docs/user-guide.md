# USB Link User Guide

USB Link runs on the same machine as Stream Deck and only controls the local USB Network Gate installation on that machine.

## Requirements

- Stream Deck 7.1 or newer
- USB Network Gate installed locally
- Target devices already visible to the local USB Network Gate instance

## Actions

### Share Device

- Scope: local physically attached USB device
- Setting: device name only
- Behavior: matches one local device by exact name, then shares it through the local USB Network Gate service

### Unshare Device

- Scope: local shared USB device
- Setting: device name only
- Behavior: matches one local device by exact name, then stops sharing it

### Connect Device

- Scope: remote USB device visible to the local machine
- Setting: device name only
- Behavior: matches one remote device by exact name, then connects it locally

### Disconnect Device

- Scope: remote USB device visible to the local machine
- Setting: device name only
- Behavior: matches one remote device by exact name, then disconnects it locally

## Notes

- Configuration is only the device name. No hostnames, ports, or credentials are stored in Stream Deck settings.
- On Windows, remote connect and disconnect act on remote devices already known to the local USB Network Gate client.
- If multiple devices share the same visible name, USB Link stops and shows an error instead of guessing.
