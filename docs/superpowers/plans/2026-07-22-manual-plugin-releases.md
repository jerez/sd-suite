# Manual Plugin Releases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace automatic Changesets-driven publishing with manually dispatched, immutable per-plugin RC and stable GitHub Releases.

**Architecture:** Keep plugin discovery and release-matrix construction in the existing `tools/plugin-release.mjs` module, but make the plan depend on explicit workflow inputs rather than a Git commit range. The GitHub Actions workflow resolves the requested ref, checks remote tag and release availability, reuses the existing native build and packaging jobs, and creates either an RC tag containing Git's canonical short SHA or a stable semantic tag.

**Tech Stack:** Node.js 24 ESM, Vitest, pnpm 11, Turbo, GitHub Actions, GitHub CLI, Elgato Stream Deck CLI

## Global Constraints

- Releases run only through `workflow_dispatch`; pushes to `main` do not publish.
- Plugin discovery is dynamic under `apps/*`; no plugin names are hardcoded.
- Inputs support one plugin, comma-separated plugins, or `all`.
- The committed `package.json` version and four-part Stream Deck manifest version are authoritative and are never modified by the workflow.
- RC tags use `<plugin>@<version>-rc.<git-short-sha>` and GitHub marks them as prereleases.
- Stable tags use `<plugin>@<version>` and GitHub publishes them as normal releases.
- Short SHAs come from `git rev-parse --short=7` for the checked-out GitHub commit.
- Existing Git tags or GitHub Releases are hard failures; tags and installer assets are never overwritten.
- Every plugin receives a separate GitHub Release containing only its own `.streamDeckPlugin` installer.
- Stable GitHub Releases do not imply Elgato Marketplace publication.
- Release notes are optional and are not a release gate.
- Changesets is removed so the repository exposes only one release policy.

---

### Task 1: Build release plans from explicit plugin and release-kind inputs

**Files:**

- Modify: `tools/plugin-release.mjs`
- Modify: `tools/plugin-release.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `parsePluginSelection(selection: string, availableNames: string[]): string[]`
- Produces: `createReleaseTag({ name: string, version: string, releaseKind: "rc" | "stable", shortSha: string }): string`
- Produces: `createReleasePlan({ plugins: Plugin[], selection: string, releaseKind: "rc" | "stable", shortSha: string }): { native: NativeRelease[], plugins: PluginRelease[] }`
- Produces CLI: `pnpm --silent release:plan --plugins <selection> --kind <rc|stable> --sha <short-sha>`

- [ ] **Step 1: Replace commit-range selection tests with explicit selection tests**

Update `tools/plugin-release.test.mjs` imports and add these focused expectations before changing the implementation:

```js
import { createReleasePlan, createReleaseTag, parsePluginSelection, toManifestVersion } from "./plugin-release.mjs";

it("parses one, multiple, and all plugin selections", () => {
    expect(parsePluginSelection("sample-plugin", ["other-plugin", "sample-plugin"])).toEqual(["sample-plugin"]);
    expect(parsePluginSelection("other-plugin, sample-plugin", ["other-plugin", "sample-plugin"])).toEqual([
        "other-plugin",
        "sample-plugin",
    ]);
    expect(parsePluginSelection("all", ["sample-plugin", "other-plugin"])).toEqual(["other-plugin", "sample-plugin"]);
});

it("rejects empty, unknown, duplicate, and mixed all selections", () => {
    expect(() => parsePluginSelection("", ["sample-plugin"])).toThrow("Plugin selection must not be empty");
    expect(() => parsePluginSelection("missing", ["sample-plugin"])).toThrow("Unknown plugin: missing");
    expect(() => parsePluginSelection("sample-plugin,sample-plugin", ["sample-plugin"])).toThrow(
        "Plugin selected more than once: sample-plugin",
    );
    expect(() => parsePluginSelection("all,sample-plugin", ["sample-plugin"])).toThrow(
        "Use all by itself or select explicit plugin names",
    );
});

it("creates immutable RC and stable release identities", () => {
    expect(createReleaseTag({ name: "sample-plugin", version: "1.2.3", releaseKind: "rc", shortSha: "edb0c41" })).toBe(
        "sample-plugin@1.2.3-rc.edb0c41",
    );
    expect(
        createReleaseTag({ name: "sample-plugin", version: "1.2.3", releaseKind: "stable", shortSha: "edb0c41" }),
    ).toBe("sample-plugin@1.2.3");
});

it("rejects invalid release kinds and short SHAs", () => {
    expect(() =>
        createReleaseTag({ name: "sample-plugin", version: "1.2.3", releaseKind: "preview", shortSha: "edb0c41" }),
    ).toThrow("Release kind must be rc or stable");
    expect(() =>
        createReleaseTag({ name: "sample-plugin", version: "1.2.3", releaseKind: "rc", shortSha: "not-a-sha" }),
    ).toThrow("Expected a hexadecimal Git short SHA");
});
```

Replace calls using `basePlugins` and `headPlugins` with this shape:

```js
const plan = createReleasePlan({
    plugins: [plugin()],
    selection: "sample-plugin",
    releaseKind: "rc",
    shortSha: "edb0c41",
});

expect(plan.plugins[0]).toMatchObject({
    name: "sample-plugin",
    prerelease: true,
    tag: "sample-plugin@1.2.3-rc.edb0c41",
    version: "1.2.3",
});
```

Add the corresponding stable assertion:

```js
expect(
    createReleasePlan({
        plugins: [plugin()],
        selection: "sample-plugin",
        releaseKind: "stable",
        shortSha: "edb0c41",
    }).plugins[0],
).toMatchObject({ prerelease: false, tag: "sample-plugin@1.2.3" });
```

Delete tests for changed versions, empty commit-range plans, decreasing versions, and manifest synchronization. Retain and adapt tests for manifest-version mismatch, native matrices, unsupported platforms, and missing native scripts.

- [ ] **Step 2: Run the release-tool tests and verify the new contract fails**

Run:

```sh
pnpm vitest run tools/plugin-release.test.mjs
```

Expected: FAIL because `parsePluginSelection` and `createReleaseTag` are not exported and `createReleasePlan` still expects base/head plugin lists.

- [ ] **Step 3: Implement selection, identity, and current-filesystem planning**

In `tools/plugin-release.mjs`:

1. Remove `compareVersions`, `synchronizePluginManifestVersions`, `git`, `readJsonAtRef`, `listFilesAtRef`, and `discoverPluginsAtRef`.
2. Keep `toManifestVersion`, filesystem discovery, plugin validation, native-platform validation, and matrix construction.
3. Add these release-input helpers:

```js
const RELEASE_KINDS = new Set(["rc", "stable"]);
const SHORT_SHA = /^[0-9a-f]{7,40}$/u;

export function parsePluginSelection(selection, availableNames) {
    const requested = selection
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    if (requested.length === 0) throw new Error("Plugin selection must not be empty");
    if (requested.includes("all")) {
        if (requested.length !== 1) throw new Error("Use all by itself or select explicit plugin names");
        return [...availableNames].sort();
    }
    const seen = new Set();
    for (const name of requested) {
        if (!availableNames.includes(name)) throw new Error(`Unknown plugin: ${name}`);
        if (seen.has(name)) throw new Error(`Plugin selected more than once: ${name}`);
        seen.add(name);
    }
    return requested;
}

export function createReleaseTag({ name, version, releaseKind, shortSha }) {
    if (!RELEASE_KINDS.has(releaseKind)) throw new Error("Release kind must be rc or stable");
    if (!SHORT_SHA.test(shortSha)) throw new Error("Expected a hexadecimal Git short SHA");
    return releaseKind === "rc" ? `${name}@${version}-rc.${shortSha}` : `${name}@${version}`;
}
```

Change the planner signature and selection loop to:

```js
export function createReleasePlan({ plugins: discoveredPlugins, selection, releaseKind, shortSha }) {
    const byName = new Map(discoveredPlugins.map((plugin) => [plugin.name, plugin]));
    const selectedNames = parsePluginSelection(selection, [...byName.keys()]);
    const plugins = [];
    const native = [];

    for (const name of selectedNames) {
        const plugin = byName.get(name);
        validatePlugin(plugin);
        const nativePlatforms = [...new Set(plugin.nativePlatforms)];
        const tag = createReleaseTag({ name: plugin.name, version: plugin.version, releaseKind, shortSha });
        plugins.push({
            hasNative: nativePlatforms.length > 0,
            installer: `${plugin.uuid}.streamDeckPlugin`,
            name: plugin.name,
            nativeArtifactPattern: `${tag}-native-*`,
            nativePlatforms,
            path: plugin.path,
            prerelease: releaseKind === "rc",
            tag,
            version: plugin.version,
        });
        for (const platform of nativePlatforms) {
            native.push({
                artifact: `${tag}-native-${platform}`,
                name: plugin.name,
                path: plugin.path,
                platform,
                runner: NATIVE_PLATFORMS[platform],
            });
        }
    }
    return { native, plugins };
}
```

Use a filesystem-only CLI:

```js
function parseArgs(args) {
    const options = { root: workspaceRoot };
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--plugins") options.selection = args[++index];
        else if (argument === "--kind") options.releaseKind = args[++index];
        else if (argument === "--sha") options.shortSha = args[++index];
        else if (argument === "--root") options.root = path.resolve(args[++index]);
        else throw new Error(`Unknown argument: ${argument}`);
    }
    if (!options.selection || !options.releaseKind || !options.shortSha) {
        throw new Error("Release planning requires --plugins, --kind, and --sha.");
    }
    return options;
}

const discoveredPlugins = await discoverFileSystemPlugins(options.root);
console.log(
    JSON.stringify(
        createReleasePlan({
            plugins: discoveredPlugins,
            selection: options.selection,
            releaseKind: options.releaseKind,
            shortSha: options.shortSha,
        }),
    ),
);
```

Keep the root `release:plan` script as `node tools/plugin-release.mjs`; Task 3 removes the Changesets-specific scripts.

- [ ] **Step 4: Run focused tests and a real repository plan**

Run:

```sh
pnpm vitest run tools/plugin-release.test.mjs
pnpm --silent release:plan --plugins audio-source,control-mesh --kind rc --sha edb0c41
```

Expected: tests PASS; JSON contains exactly `audio-source` and `control-mesh`, with tags ending in `-rc.edb0c41`, and native matrix entries only for declared native platforms.

- [ ] **Step 5: Commit the explicit release planner**

```sh
git add tools/plugin-release.mjs tools/plugin-release.test.mjs package.json
git commit -m "feat(release): plan manual plugin releases"
```

---

### Task 2: Convert the release workflow to immutable manual RC and stable publishing

**Files:**

- Modify: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: `pnpm release:plan --plugins <selection> --kind <rc|stable> --sha <short-sha>` from Task 1
- Consumes plan fields: `plugins[].tag`, `plugins[].prerelease`, `plugins[].installer`, `plugins[].path`, and native matrix fields
- Produces: manually dispatched GitHub RC or stable Releases with one installer per plugin

- [ ] **Step 1: Replace the push trigger with explicit workflow inputs**

Change the workflow header to:

```yaml
name: Release plugins

on:
    workflow_dispatch:
        inputs:
            ref:
                description: Git branch, tag, or commit to release
                required: true
                default: main
                type: string
            plugins:
                description: Plugin name, comma-separated names, or all
                required: true
                default: all
                type: string
            release_kind:
                description: GitHub release maturity
                required: true
                default: rc
                type: choice
                options:
                    - rc
                    - stable
            notes:
                description: Optional release notes applied to every selected plugin
                required: false
                type: string

permissions:
    contents: write

concurrency:
    group: release-plugins-${{ inputs.ref }}-${{ inputs.release_kind }}
    cancel-in-progress: false
```

- [ ] **Step 2: Resolve the exact source commit and preflight every identity**

In the `plan` job, check out `inputs.ref` with full history. Replace the base/head planner step with:

```yaml
- name: Resolve release source
  id: source
  shell: bash
  run: |
      source_sha="$(git rev-parse HEAD)"
      short_sha="$(git rev-parse --short=7 "$source_sha")"
      echo "source_sha=$source_sha" >> "$GITHUB_OUTPUT"
      echo "short_sha=$short_sha" >> "$GITHUB_OUTPUT"

- name: Build release plan
  id: plan
  env:
      PLUGIN_SELECTION: ${{ inputs.plugins }}
      RELEASE_KIND: ${{ inputs.release_kind }}
      SHORT_SHA: ${{ steps.source.outputs.short_sha }}
  run: |
      plan_file="$RUNNER_TEMP/plugin-release-plan.json"
      pnpm --silent release:plan \
        --plugins "$PLUGIN_SELECTION" \
        --kind "$RELEASE_KIND" \
        --sha "$SHORT_SHA" > "$plan_file"
      echo "native=$(jq -c '.native' "$plan_file")" >> "$GITHUB_OUTPUT"
      echo "plugins=$(jq -c '.plugins' "$plan_file")" >> "$GITHUB_OUTPUT"

- name: Reject existing release identities
  env:
      GH_TOKEN: ${{ github.token }}
      RELEASES: ${{ steps.plan.outputs.plugins }}
  shell: bash
  run: |
      while IFS= read -r tag; do
        if git rev-parse --verify --quiet "refs/tags/$tag" >/dev/null; then
          echo "Release tag $tag already exists and cannot be overwritten." >&2
          exit 1
        fi
        if gh release view "$tag" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
          echo "GitHub Release $tag already exists and cannot be overwritten." >&2
          exit 1
        fi
      done < <(jq -r '.[].tag' <<< "$RELEASES")
```

Expose `source_sha`, `native`, and `plugins` as plan-job outputs. Every downstream checkout uses `${{ needs.plan.outputs.source_sha }}` rather than a moving branch name.

- [ ] **Step 3: Keep native and packaging jobs but make artifacts identity-specific**

Retain the existing runner matrix, native commands, archive transfer, staging, and package commands. Ensure both downstream jobs use:

```yaml
- name: Check out repository
  uses: actions/checkout@v7
  with:
      ref: ${{ needs.plan.outputs.source_sha }}
```

Use the planner-provided native artifact names and patterns unchanged; they now contain the complete RC or stable identity and cannot collide across runs.

- [ ] **Step 4: Replace create-or-update behavior with create-only publication**

Replace the current release shell step with:

```yaml
- name: Create GitHub Release
  shell: bash
  env:
      GH_TOKEN: ${{ github.token }}
      INSTALLER: ${{ matrix.release.path }}/${{ matrix.release.installer }}
      PLUGIN_NAME: ${{ matrix.release.name }}
      PLUGIN_VERSION: ${{ matrix.release.version }}
      PRERELEASE: ${{ matrix.release.prerelease }}
      RELEASE_NOTES: ${{ inputs.notes }}
      RELEASE_TAG: ${{ matrix.release.tag }}
      SOURCE_SHA: ${{ needs.plan.outputs.source_sha }}
  run: |
      notes_file="$RUNNER_TEMP/release-notes.md"
      if [[ -n "$RELEASE_NOTES" ]]; then
        printf '%s\n' "$RELEASE_NOTES" > "$notes_file"
      else
        printf '%s %s (%s)\n\nSource commit: `%s`\n' \
          "$PLUGIN_NAME" "$PLUGIN_VERSION" \
          "$([[ "$PRERELEASE" == "true" ]] && printf 'release candidate' || printf 'stable')" \
          "$SOURCE_SHA" > "$notes_file"
      fi

      release_args=(
        "$RELEASE_TAG"
        "$INSTALLER"
        --latest=false
        --notes-file "$notes_file"
        --repo "$GITHUB_REPOSITORY"
        --target "$SOURCE_SHA"
        --title "$PLUGIN_NAME $PLUGIN_VERSION"
      )
      if [[ "$PRERELEASE" == "true" ]]; then
        release_args+=(--prerelease)
      fi
      gh release create "${release_args[@]}"
```

Do not retain `gh release upload`, `--clobber`, or `--generate-notes`.

- [ ] **Step 5: Validate workflow structure and prohibited overwrite behavior**

Run:

```sh
pnpm exec prettier --check .github/workflows/release.yml
rg -n "workflow_dispatch|release_kind|git rev-parse --short=7|gh release create|--prerelease" .github/workflows/release.yml
rg -n "push:|--clobber|gh release upload|--generate-notes" .github/workflows/release.yml
```

Expected: Prettier passes; the first search finds all manual-release elements; the second search returns no matches.

- [ ] **Step 6: Commit the manual workflow**

```sh
git add .github/workflows/release.yml
git commit -m "ci(release): publish immutable manual releases"
```

---

### Task 3: Remove Changesets and align repository documentation and scaffolding

**Files:**

- Delete: `.changeset/config.json`
- Delete: `.changeset/README.md`
- Delete: `.changeset/fifty-nails-add.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `docs/releases.md`
- Modify: `docs/plugin-scaffolding.md`
- Modify: `tools/create-streamdeck-plugin.mjs`
- Modify: `tools/create-streamdeck-plugin.test.mjs`

**Interfaces:**

- Consumes: the manual workflow and tag model from Tasks 1 and 2
- Produces: one documented release policy with no Changesets commands, dependency, CI gate, or generated copy

- [ ] **Step 1: Change the scaffolding test to require manual-release guidance**

Replace the Changesets expectation in `tools/create-streamdeck-plugin.test.mjs` with:

```js
expect(readme).toContain("Plugin versions are changed explicitly in reviewed pull requests.");
expect(readme).toContain("Publish installers with the manual Release plugins workflow.");
expect(readme).not.toContain("changeset");
```

- [ ] **Step 2: Run the generator test and verify the old copy fails**

Run:

```sh
pnpm vitest run tools/create-streamdeck-plugin.test.mjs
```

Expected: FAIL because generated READMEs still instruct maintainers to run `pnpm changeset`.

- [ ] **Step 3: Replace generated release guidance**

In `renderPluginReadme` in `tools/create-streamdeck-plugin.mjs`, replace the two Changesets/version-PR lines with:

```js
"Plugin versions are changed explicitly in reviewed pull requests.",
"Publish installers with the manual Release plugins workflow.",
```

Run:

```sh
pnpm vitest run tools/create-streamdeck-plugin.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Remove Changesets commands, dependency, files, and CI gate**

Delete the `.changeset` directory contents. From `package.json`, remove:

```json
"changeset": "changeset",
"release:status": "changeset status",
"release:version": "changeset version && node tools/plugin-release.mjs --sync-manifests"
```

and remove the `@changesets/cli` development dependency. Remove the `Validate release intent` step from `.github/workflows/ci.yml`.

Regenerate the lockfile from the committed package manifest:

```sh
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` no longer contains the root `@changesets/cli`
importer or the CLI's dependency graph. Unrelated transitive packages such as
`@changesets/types`, still required through other tooling, may remain.

- [ ] **Step 5: Rewrite the release documentation around the approved manual model**

Update `README.md` to describe “explicit plugin versions and manually dispatched GitHub Releases” instead of “Changesets for independent plugin versions and reviewed release intent.” Remove the pull-request requirement for Changeset files.

Rewrite `docs/releases.md` with these exact sections:

```markdown
# Plugin releases

## Version plugins

Plugin versions are independent and are changed explicitly in normal reviewed pull requests. Keep `package.json` `major.minor.patch` synchronized with manifest `major.minor.patch.0`.

## Start a release

Run the `Release plugins` workflow manually. Select a Git ref, one or more dynamically discovered plugins (or `all`), `rc` or `stable`, and optional notes.

## Release candidates

RCs use `<plugin>@<version>-rc.<short-sha>`, are GitHub prereleases, and retain the committed manifest version. They are manually side-loaded and do not provide automatic upgrade ordering.

## Stable releases

Stable releases use `<plugin>@<version>` and are normal GitHub Releases. Stable means canonical on GitHub, not submitted to the Elgato Marketplace.

## Immutability

Existing tags and releases are never replaced. A duplicate identity fails before publication.

## Native plugin contract

Native plugins declare `release.nativePlatforms` and package-owned `release:native` and `native:stage` scripts. Supported platform names remain `macos` and `windows`; release-native output stays under `.native/<platform>/`, and staging copies and validates the complete platform set inside the plugin package.

## Artifact ownership

Native executables, compiler output, staged files, and installers remain ignored build products. Temporary native transfer artifacts retain one-day storage, while final installers belong to their plugin-specific GitHub Releases. Normal CI does not build release-native output, package installers, or publish releases.
```

Expand those concise requirements with the existing JSON declaration example and package-owned task details. Update `docs/plugin-scaffolding.md` by removing `pnpm changeset`, describing explicit version edits, and stating that generated plugins are dynamically discoverable by the manual workflow.

- [ ] **Step 6: Prove no active Changesets policy remains**

Run:

```sh
rg -n "pnpm changeset|@changesets/cli|release:status|release:version|--sync-manifests" \
  README.md docs package.json tools .github pnpm-lock.yaml \
  --glob '!docs/superpowers/**'
```

Expected: no direct Changesets commands, CLI dependency, release scripts, or
active policy matches. Unrelated transitive `@changesets/types` lockfile entries
are allowed.

- [ ] **Step 7: Run focused and repository-wide verification**

Run:

```sh
pnpm vitest run tools/plugin-release.test.mjs tools/create-streamdeck-plugin.test.mjs
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm plugin:validate
git diff --check
```

Expected: every command exits successfully. If the existing commitlint version mismatch blocks dependency lifecycle scripts, report it as a pre-existing repository issue rather than bypassing verification silently.

- [ ] **Step 8: Commit the policy migration**

```sh
git add .changeset .github/workflows/ci.yml package.json pnpm-lock.yaml README.md docs/releases.md docs/plugin-scaffolding.md tools/create-streamdeck-plugin.mjs tools/create-streamdeck-plugin.test.mjs
git commit -m "docs(release): adopt manual plugin versioning"
```

---

### Task 4: Verify the complete release system without publishing

**Files:**

- Test only; no expected file changes

**Interfaces:**

- Consumes: all outputs from Tasks 1–3
- Produces: evidence that all current plugins plan successfully and that the repository is ready for a controlled manual workflow run

- [ ] **Step 1: Generate RC plans for every current plugin**

Run:

```sh
pnpm --silent release:plan --plugins all --kind rc --sha edb0c41
```

Expected: one plugin entry for each discovered Stream Deck plugin; each tag ends in `-rc.edb0c41`; native entries match package-owned platform declarations.

- [ ] **Step 2: Generate stable plans for every current plugin**

Run:

```sh
pnpm --silent release:plan --plugins all --kind stable --sha edb0c41
```

Expected: the same plugin set with semantic tags such as `audio-source@0.1.0`, `control-mesh@0.1.0`, and `usb-link@0.1.0`, all with `prerelease: false`.

- [ ] **Step 3: Re-run the complete verification suite from a clean worktree**

Run:

```sh
git status --short
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm plugin:validate
```

Expected: `git status --short` is empty and every verification command succeeds.

- [ ] **Step 4: Review the first live-run procedure without executing it**

Confirm the GitHub Actions UI will use:

```text
ref: main
plugins: all
release_kind: rc
notes: Initial release candidate.
```

Do not dispatch the workflow as part of implementation. Publishing requires a separate explicit maintainer decision after the implementation pull request is merged.
