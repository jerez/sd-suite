# Control Mesh Visual Identity

Control Mesh is the first implementation of the workspace visual identity in the
workspace-level `docs/visual-identity.md`.

## Direction

Control Mesh uses the shared dark command tile with a sparse peer-routing glyph.

```text
Accent:   #22D3EE
Success:  #34D399
Error:    #FB7185
Metaphor: trusted peer routing
```

Meaning:

```text
Center diamond: local Control Mesh route
Outer nodes:    trusted peers
Links:          trust paths
Horizontal path: executable remote route
Arrow:          remote action execution
```

Avoid cloud networking, VPN, Wi-Fi router, blockchain, server monitoring, and
generic cybersecurity symbols. Control Mesh is about explicit trusted peer
execution, not infrastructure monitoring or public networking.

## Asset Mapping

Manifest assets:

```text
Icon:
  imgs/plugin/icon.png
  imgs/plugin/icon@2x.png

CategoryIcon:
  imgs/plugin/category-glyph.svg

Actions[].Icon:
  imgs/actions/control-mesh-setup/icon.svg
  imgs/actions/execute-remote-action/icon.svg

Actions[].States[].Image:
  imgs/actions/control-mesh-setup/key-default.svg
  imgs/actions/execute-remote-action/key-default.svg
```

Source and optional state assets:

```text
imgs/plugin/icon.source.svg
imgs/plugin/marketplace.source.svg
imgs/plugin/marketplace.png
imgs/actions/execute-remote-action/key-active.svg
imgs/actions/execute-remote-action/key-success.svg
imgs/actions/execute-remote-action/key-error.svg
```

If Marketplace gallery images are added, they should follow the same direction
and use real product UI or workflow visuals instead of abstract placeholder
art.
