# Audio Source visual identity

This reference records the plugin-owned visual decisions and export inventory
for maintainers changing Audio Source assets.

## Direction

Audio Source uses an **endpoint-routing** metaphor: a source point, a horizontal
route, an arrow, waveform bars, and a destination point. The route communicates
selection and direction without using third-party device or audio-brand marks.

The plugin accent is warning amber, `#F59E0B`. It highlights the route arrow
and destination endpoint. Keep the accent specific to the destination signal;
do not recolor the complete glyph.

## Suite palette

The plugin icon and marketplace source use the shared suite colors:

| Role                | Color     |
| ------------------- | --------- |
| Background          | `#071016` |
| Raised surface      | `#0B1220` |
| Border              | `#1E293B` |
| Primary glyph       | `#E5EEF8` |
| Muted route         | `#64748B` |
| Audio Source accent | `#F59E0B` |

The dark rounded tile, light waveform, muted route, and amber endpoint keep the
plugin aligned with the workspace identity in
[`docs/visual-identity.md`](../../../docs/visual-identity.md).

## Category and action treatment

Stream Deck action-list assets are monochrome white on transparency:

- `imgs/plugin/category-glyph.svg` is the 28 by 28 source glyph for category
  exports.
- `imgs/actions/audio/icon.svg` is the 20 by 20 category action icon.
- Both use the endpoint-routing geometry with `#FFFFFF` strokes and endpoints.

Do not add the amber accent or a dark tile to category and action-list assets.
Those assets must remain legible in Stream Deck's list treatment.

## Encoder treatment

`imgs/actions/audio/encoder.svg` is a 72 by 72 white endpoint-routing glyph for
the encoder action state. Runtime dial feedback does not rasterize this asset.
The TypeScript renderers create device and transport SVGs from normalized device
data and place them in the shared 200 by 100 layout.

The four feedback modes preserve a compact hierarchy:

- idle: centered 38-pixel device icon and active-device label
- browse: 28-pixel adjacent icons, 38-pixel selected icon, and selected label
- confirm: centered check mark and selected-device label
- details: 18-pixel transport icon, transport label, and device label

Input and output renderers share the layout but select scope-specific device
glyphs.

## Source SVG inventory

| Source                               | Purpose                 | View box   |
| ------------------------------------ | ----------------------- | ---------- |
| `imgs/plugin/icon.source.svg`        | Plugin icon master      | 512 by 512 |
| `imgs/plugin/marketplace.source.svg` | Marketplace icon master | 512 by 512 |
| `imgs/plugin/category-glyph.svg`     | Category export source  | 28 by 28   |
| `imgs/actions/audio/icon.svg`        | Action-list icon        | 20 by 20   |
| `imgs/actions/audio/encoder.svg`     | Encoder state icon      | 72 by 72   |

Keep the source SVGs with the plugin. Preserve their geometry when producing
raster variants.

## Exported PNG inventory

| File                               | Size       |
| ---------------------------------- | ---------- |
| `imgs/plugin/category-icon.png`    | 28 by 28   |
| `imgs/plugin/category-icon@2x.png` | 56 by 56   |
| `imgs/plugin/icon.png`             | 256 by 256 |
| `imgs/plugin/icon@2x.png`          | 512 by 512 |
| `imgs/plugin/marketplace.png`      | 288 by 288 |
| `imgs/plugin/marketplace@2x.png`   | 512 by 512 |

The package asset tests require RGBA PNG encoding at these dimensions and
reject embedded Exif chunks.
