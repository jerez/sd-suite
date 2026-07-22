# Plugin Scaffolding

Plugin scaffolding is implemented by the root `plugin:create` script. It renders
the pinned Elgato CLI template into this monorepo layout instead of running the
interactive `streamdeck create` wizard in the repository root.

## Commands

```sh
pnpm plugin:create <plugin-name>
pnpm plugin:create <plugin-name> --dry-run
pnpm format
pnpm lint:fix
pnpm plugin:validate
pnpm plugin:pack
pnpm changeset
```

- `plugin:create` creates a new plugin package under `apps/<plugin-name>/`.
- `plugin:create --dry-run` prints the derived names and target path without
  writing files.
- `format` applies the workspace Prettier config after generating or editing
  files.
- `lint:fix` applies ESLint fixes after generating or editing files.
- `plugin:validate` builds and validates every plugin package under `apps/`
  through Turbo.
- `plugin:pack` runs package-level Stream Deck packaging through Turbo.
- `changeset` records which plugin versions a shipped change should bump.

## Generator Behavior

The generator lives at `tools/create-streamdeck-plugin.mjs` and uses the pinned
root `@elgato/cli` dependency as its compatibility source.

For each plugin, it:

- accepts a kebab-case plugin name
- derives the plugin UUID as `dev.jerez.sds.<plugin-name>`
- derives the `.sdPlugin` folder as `dev.jerez.sds.<plugin-name>.sdPlugin`
- treats `.streamDeckPlugin` as the packaged installer artifact, not a source
  directory name
- renders the Elgato CLI template from `@elgato/cli/template`
- maps Elgato's template package into `apps/<plugin-name>/`
- skips template `.vscode` files because editor settings are workspace-owned
- adapts `package.json` for pnpm workspace scripts and package-local Stream Deck
  commands
- adapts `tsconfig.json` to extend the root `tsconfig.base.json`
- makes the package eligible for the generic release planner through its
  package version and single `.sdPlugin/manifest.json`
- creates `apps/<plugin-name>/README.md` from scaffold metadata such as package
  name, display name, UUID, `.sdPlugin` folder, SDK version, CLI version, and
  package commands
- refuses to overwrite an existing `apps/<plugin-name>/` directory

Before writing, the generator checks for the Elgato template files it renders:

```text
package.json.ejs
rollup.config.mjs.ejs
src/plugin.ts
tsconfig.json.ejs
com.elgato.template.sdPlugin/manifest.json.ejs
```

If one is missing, the command exits with the missing template path.

## Generated Shape

Each plugin lives under `apps/<plugin-name>/`:

```text
apps/
  <plugin-name>/
    package.json
    README.md
    src/
    <plugin-uuid>.sdPlugin/
```

The plugin UUID uses the workspace reverse-DNS root:

```text
dev.jerez.sds.<plugin-name>
```

The `.sdPlugin` folder name matches the plugin UUID exactly:

```text
dev.jerez.sds.<plugin-name>.sdPlugin
```

When packaged for installation, that directory produces an installer file named
`dev.jerez.sds.<plugin-name>.streamDeckPlugin`.

## Generated Package Scripts

Generated plugin packages own their Stream Deck lifecycle commands:

```json
{
    "scripts": {
        "build": "rollup -c",
        "watch": "rollup -c -w --watch.onEnd=\"streamdeck restart <plugin-uuid>\"",
        "dev": "streamdeck dev",
        "link": "streamdeck link <plugin-uuid>.sdPlugin",
        "restart": "streamdeck restart <plugin-uuid>",
        "validate": "streamdeck validate <plugin-uuid>.sdPlugin --no-update-check",
        "pack": "pnpm run build && streamdeck pack <plugin-uuid>.sdPlugin -f --no-update-check",
        "typecheck": "tsc --noEmit",
        "lint": "eslint . --max-warnings 0",
        "test": "vitest run --passWithNoTests"
    }
}
```

When invoking package scripts through `pnpm --filter`, use `run` for script
names that overlap with pnpm commands. For example, use
`pnpm --filter <plugin-name> run pack` instead of `pnpm --filter <plugin-name> pack`.

Root scripts orchestrate package tasks:

```json
{
    "scripts": {
        "format": "prettier . --write",
        "lint:fix": "eslint . --fix",
        "plugin:create": "node tools/create-streamdeck-plugin.mjs",
        "plugin:pack": "turbo run pack",
        "plugin:validate": "turbo run validate"
    }
}
```

Generated plugins do not own GitHub workflows. The workspace release workflow
selects a generated plugin only after a reviewed version pull request increases
its package version. See [Plugin releases](./releases.md).

After creating a plugin package, run the workspace format and lint fixers before
checking or committing generated files:

```sh
pnpm format
pnpm lint:fix
```

## Build Tool Selection

Generated packages start from Elgato's Rollup-based SDK scaffold because that is
the smallest baseline for simple plugin backend code and static property
inspectors.

Keep direct Rollup when a plugin stays close to that baseline: TypeScript plugin
backend, static or simple `*.sdPlugin/ui` files, and no bundled frontend
application.

When a static property inspector uses SDPI components, depend on the shared
`@workspace/sdpi-components` package and have the bundler emit its
`sdpi-components.js` export into the plugin's `.sdPlugin/ui/` folder during
build. Do not vendor independent copies per plugin, and do not rely on the CDN
for packaged plugins.

Switch a plugin to Vite when it needs a bundled property inspector, React,
Tailwind CSS, shadcn-managed UI, or imports from shared workspace UI packages.
For those plugins, Vite owns both generated targets:

- Node plugin backend output under `<plugin-uuid>.sdPlugin/bin/`
- Chromium property inspector output under `<plugin-uuid>.sdPlugin/ui/`

Turbo still orchestrates package-level `build`, `validate`, and `pack` tasks.
When a plugin generates UI output, include `*.sdPlugin/ui/**` in Turbo build
outputs for cache correctness.

## Documentation Boundaries

- Workspace documentation in `docs/` describes conventions and shared project
  strategy.
- The generator creates `apps/<plugin-name>/README.md` as a placeholder from
  generic scaffold metadata and generated package information.
- The generator does not copy or move workspace documentation into a plugin
  package.
- Plugin-specific design notes and implementation plans can live under
  `apps/<plugin-name>/docs/` when that documentation is intentionally created
  for the plugin.
- `docs/projects.md` is the workspace index that routes readers to the
  plugin-owned documentation.

## Scope

Scaffolding creates the plugin project shape only. It keeps Elgato's baseline
template behavior and does not add product implementation, public distribution
setup, machine-specific setup, device-specific workflows, or undocumented Stream Deck
internals.
