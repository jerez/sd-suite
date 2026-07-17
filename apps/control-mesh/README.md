# Control Mesh

Control Mesh lets one Stream Deck trigger Elgato MCP executable actions on
another trusted machine on the same local network.

## When to Use Control Mesh

- You want one machine to host the Stream Deck hardware and another machine to
  execute the target action.
- The remote machine already exposes the target workflow through Elgato MCP.
- Both machines are on the same trusted local network.

## When Not to Use Control Mesh

- You need same-machine service control. Use a local-only plugin such as
  [USB Link](../usb-link/README.md) instead.
- You need internet-facing or untrusted-network deployment hardening.
- The remote machine does not expose the target workflow as an Elgato MCP
  executable action.

## Documentation

- [User Guide](./docs/user-guide.md)
- [Developer Guide](./docs/developer-guide.md)
- [Visual Identity](./docs/visual-identity.md)
