# Naming

## Workspace

Use kebab-case for repository, package, and folder names.

## Stream Deck Identifiers

Elgato plugin UUIDs use reverse-DNS format and only lowercase alphanumeric
characters, hyphens, and periods.

Use `dev.jerez.sds` as the reverse-DNS root.

Examples:

```text
dev.jerez.sds.control-mesh
dev.jerez.sds.control-mesh.execute-remote-action
```

Plugin folder names must match the plugin UUID plus `.sdPlugin`:

```text
dev.jerez.sds.control-mesh.sdPlugin
```

Packaged installer files use the same UUID with the `.streamDeckPlugin`
suffix. Do not use `.streamDeckPlugin` for plugin directory names.
