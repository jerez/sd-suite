# AGENTS.md

## Working in This Repo

- Read `README.md` and `docs/*.md` before making project-shaping changes.
- Treat `README.md` and `docs/*.md` as the source of truth for project conventions, stack direction, naming, and layout.
- Verify Stream Deck-specific decisions against official Elgato documentation before changing project conventions.
- Do not add app-specific or plugin-specific files unless explicitly requested.
- Keep this workspace generic: no machine names, desk setup, or local automation details.

## Tooling

- Use the Node.js version declared in `.nvmrc`.
- Use the pnpm version declared in `package.json`.
- Use `pnpm` for package management.
- Use Turbo task scripts from the repository root.
- Do not duplicate stack, naming, or layout policy here. Update `README.md` or `docs/*.md` instead.

## Shared and Local Notes

- This file and `CLAUDE.md` are the shared instructions for the repository.
- If you need working-copy notes or personal preferences that apply only on your machine or in your current checkout, keep them in `./AGENTS.override.md` or `./CLAUDE.local.md` and leave them untracked.
- Keep Codex runtime or host-specific configuration under `./.codex/` and Claude local settings in `./.claude/settings.local.json`. Leave those files untracked too.
- Do not commit machine-specific approvals, local paths, personal workflow habits, or host-only tool configuration.

## Local Working Files

- Keep temporary execution artifacts, process notes, plans, handoff notes, and
  similar working files under `./.tmp/` as untracked assets.

## Scope and Effort

- Prefer the minimal solution that answers what was asked. Do not expand scope unilaterally.
- Before starting large research tasks, confirm scope with a one-line plan.
- If blocked or unable to proceed, stop and ask instead of repeatedly retrying or working around the issue.
- If a task requires more effort than expected or has unexpected dependencies, stop and surface it before proceeding.

## Verification

- Run focused checks for files changed.
- For broad workspace changes, prefer:
    - `pnpm format:check`
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm test`
