# sd-suite

Open-source Stream Deck plugins and shared tooling.

## Included Projects

### Control Mesh

Control Mesh is a Stream Deck plugin for trusted local-network control through
the official Elgato MCP server. It is a fresh implementation informed by
earlier private iterations and updated for the current Stream Deck MCP
ecosystem.

## Project Background

`sd-suite` is a public consolidation of earlier personal Stream Deck plugin
work developed in private over time.

## AI Tooling

AI tooling is actively used in this project and is intended to remain part of
the development and release workflow.

## Repository Layout

```text
apps/
  <plugin>/
    dev.jerez.sds.<plugin>.sdPlugin/
    src/
    package.json

packages/
docs/
tools/
```

Plugin-specific documentation lives with each plugin. Shared naming,
scaffolding, and visual identity conventions live in:

- [`docs/naming.md`](docs/naming.md)
- [`docs/plugin-scaffolding.md`](docs/plugin-scaffolding.md)
- [`docs/visual-identity.md`](docs/visual-identity.md)

## Tooling

- Node.js `24.16.0`
- pnpm `11.5.0`
- pnpm workspace with Turbo
- TypeScript, ESLint, Prettier, and Vitest
- Package-level Stream Deck validation and packaging commands where applicable

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
```

Plugin packages can add their own `validate` and `pack` steps on top of the
root baseline.

## Pull Requests

Pull request titles should follow Conventional Commits, for example
`fix(control-mesh): handle expired MCP session`. With squash-only merges, the
PR title is intended to become the final commit message on `main`.

## Trademark Notice

Elgato, Stream Deck, and other third-party marks are used for identification
and compatibility only and remain the property of their respective owners. This
project is independent and not affiliated with or endorsed by those parties.
