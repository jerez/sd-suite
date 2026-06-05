# Workspace SDPI Components

`@workspace/sdpi-components` centralizes the Stream Deck Property Inspector
Components browser bundle used by native property inspectors in this monorepo.

The package version matches the pinned upstream `sdpi-components` release. Its
package export resolves to a tiny wrapper module that imports the pinned
upstream browser bundle from `sdpi-components/dist/sdpi-components.js`.

Plugins that use static native property inspectors should depend on this package
and emit `@workspace/sdpi-components/sdpi-components.js` into their packaged
`.sdPlugin/ui/` folder during build. The installed plugin must still include a
local `sdpi-components.js` file so it follows Elgato's distribution guidance and
does not rely on the CDN at runtime.

When this package is updated to a new upstream SDPI version, every plugin that
packages the asset must be rebuilt and version-bumped because its distributed UI
asset changed.
