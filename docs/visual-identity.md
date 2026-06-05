# Visual Identity

This workspace uses a compact visual identity for Stream Deck plugins. The goal
is a recognizable family language, not a design system, component library,
Storybook setup, landing page, or marketing package.

## Direction

Use dark command tiles with precise geometric capability glyphs.

The identity should feel minimal, modern, technical, compact, precise, and
operational. Avoid busy diagrams, cybersecurity cliches, clouds, shields,
padlocks as primary symbols, device illustrations, blockchain or network-globe
imagery, text inside small icons, third-party logos, broad gradients, decorative
complexity, and fake umbrella product names.

## Shared Language

Key and plugin icons use a dark rounded container. Sidebar category and action
icons use the same geometry in the monochrome action-list form required by
Elgato.

Conceptual geometry:

```text
Canvas: 64 x 64
Tile: x=4, y=4, width=56, height=56
Tile radius: 14
Glyph safe area: x=14-50, y=14-50
```

Palette:

```text
Background:      #071016
Raised surface:  #0B1220
Soft highlight:  #101827
Border:          #1E293B
Primary glyph:   #E5EEF8
Muted glyph:     #64748B
Disabled glyph:  #475569
Active:          #38BDF8
Success:         #34D399
Warning:         #F59E0B
Error:           #FB7185
```

Icon grammar:

```text
Point:     circle, entity, source, target, or anchor
Core:      diamond, capability, processor, or module
Link:      line, relationship, binding, or flow
Direction: arrow, trigger, dispatch, send, or invoke
Stack:     offset rectangles, multiple items, pages, or layers
Pulse:     emphasized link with point, refresh, scan, or active state
```

Every plugin icon should use one accent color, one clear glyph, and no more than
five major visual elements. The glyph must remain legible at Stream Deck key
sizes.

## States

State variants should keep the same base glyph and change only the meaningful
signal:

```text
Default:   neutral route or capability
Active:    active route emphasis
Success:   success accent on completed target or path
Warning:   warning accent on recoverable issue
Error:     error accent on failed path or blocked target
Disabled:  muted glyph and reduced route emphasis
```

## Elgato Requirements

Official Elgato documentation controls exported asset requirements:

- Manifest image paths omit file extensions and are configured per manifest
  field, such as `Icon`, `CategoryIcon`, `Actions[].Icon`, and
  `Actions[].States[].Image`.
- Plugin preference `Icon` assets use PNG at 256 x 256 and 512 x 512.
- `CategoryIcon` assets use PNG or SVG. Raster exports are 28 x 28 and 56 x 56.
  These action-list icons must be monochromatic, use `#FFFFFF`, and have a
  transparent background.
- `Actions[].Icon` assets use PNG or SVG. Raster exports are 20 x 20 and
  40 x 40. These action-list icons must be monochromatic, use `#FFFFFF`, and
  have a transparent background.
- Key state images use SVG, PNG, or GIF. Raster exports are 72 x 72 and
  144 x 144. Key images are not limited to monochrome.
- Marketplace app icons are separate Maker Console assets: PNG, 288 x 288.
- Marketplace thumbnail and gallery images are PNG, 1920 x 960. Marketplace
  listings require three gallery items.

Use SVG for category, action, and key assets unless a specific field or
distribution surface requires PNG. Commit source SVGs and required PNG exports.
Do not add a workspace raster-generation tool until more than one plugin needs a
repeatable shared workflow.

Sources checked:

- https://docs.elgato.com/streamdeck/sdk/references/manifest/
- https://docs.elgato.com/guidelines/stream-deck/plugins/
- https://docs.elgato.com/guidelines/products/

## Future Plugins

Future plugins should use the shared tile, palette, geometry, and glyph grammar,
then choose one plugin-specific accent and one capability metaphor. Keep
plugin-specific assets inside the plugin package. Update this document only when
the shared language changes.
