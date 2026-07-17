# USB Link Visual Identity

USB Link applies the shared workspace visual language from
[`docs/visual-identity.md`](/Users/jerez/Projects/personal/sd-suite/docs/visual-identity.md)
with a standard USB trident as its capability glyph.

## Direction

USB Link uses the shared dark command tile with a single USB control symbol.

```text
Accent:   #60A5FA
Success:  #34D399
Error:    #FB7185
Metaphor: local USB path control
```

Source geometry:

```text
Base symbol: adapted from Bootstrap Icons `usb-symbol`
License:     MIT
```

Meaning:

```text
USB trident: local USB capability surface
Arrow badge: share action
Close badge: unshare action
Plus badge:  connect action
Minus badge: disconnect action
Ring:        active execution
Check:       successful completion
Cross:       failed completion
```

Avoid cable illustrations, vendor logos, USB hardware photos, cloud routing,
Wi-Fi, and network topology diagrams. USB Link is about local USB service
control, not transport infrastructure branding.

## Asset Mapping

Manifest assets:

```text
Icon:
  imgs/plugin/icon.png
  imgs/plugin/icon@2x.png

CategoryIcon:
  imgs/plugin/category-glyph.svg

Actions[].Icon:
  imgs/actions/share-device/icon.svg
  imgs/actions/unshare-device/icon.svg
  imgs/actions/connect-device/icon.svg
  imgs/actions/disconnect-device/icon.svg

Actions[].States[].Image:
  imgs/actions/share-device/key-default.svg
  imgs/actions/unshare-device/key-default.svg
  imgs/actions/connect-device/key-default.svg
  imgs/actions/disconnect-device/key-default.svg
```

Source and exported plugin assets:

```text
imgs/plugin/icon.source.svg
imgs/plugin/icon.png
imgs/plugin/icon@2x.png
imgs/plugin/marketplace.source.svg
imgs/plugin/marketplace.png
imgs/plugin/marketplace@2x.png
imgs/plugin/category-icon.png
imgs/plugin/category-icon@2x.png
```
