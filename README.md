# sd-suite

`sd-suite` is a monorepo for Stream Deck plugins and shared tooling.

## Start Here

- [Project documentation index](./docs/projects.md)
- [Naming](./docs/naming.md)
- [Plugin scaffolding](./docs/plugin-scaffolding.md)
- [Plugin releases](./docs/releases.md)
- [Visual identity](./docs/visual-identity.md)

Plugin-specific documentation lives with each plugin package. Start with the
package README, then use the package guides under `apps/<plugin>/docs/`.

## Repository Layout

```text
apps/
  <plugin>/
    README.md
    docs/
    dev.jerez.sds.<plugin>.sdPlugin/
    src/
    package.json

packages/
docs/
tools/
```

## Tooling

- Node.js `24.16.0`
- pnpm `11.5.0`
- pnpm workspace with Turbo
- TypeScript, ESLint, Prettier, and Vitest
- Package-level Stream Deck validation and packaging commands where applicable
- Changesets for independent plugin versions and reviewed release intent

## Working With Agents

This repository keeps shared agent instructions in `AGENTS.md`. `CLAUDE.md`
exists only as a thin bridge so Claude loads the same repo instructions without
duplicating them. If you want local notes or personal preferences for your
current checkout, put them in `AGENTS.override.md` or `CLAUDE.local.md` and
leave them untracked.

Keep tool runtime config in `./.codex/` or `./.claude/settings.local.json`,
and keep temporary plans, handoff notes, and other process artifacts under
`./.tmp/`. None of those local files are part of the committed repo contract.

## Verification

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm plugin:validate
```

`pnpm plugin:validate` builds and validates every plugin package under `apps/`.

## Pull Requests

Pull request titles should follow Conventional Commits, for example
`fix(control-mesh): handle expired MCP session`. With squash-only merges, the
PR title is intended to become the final commit message on `main`.

Pull requests that change shipped plugin behavior include a Changeset for each
affected plugin. See [Plugin releases](./docs/releases.md) for version selection,
version pull requests, native build ownership, and GitHub Release artifacts.

## Trademark Notice

Elgato, Stream Deck, and other third-party marks are used for identification
and compatibility only and remain the property of their respective owners. This
project is independent and not affiliated with or endorsed by those parties.
