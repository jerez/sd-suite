# Manual plugin releases

## Objective

Provide a small, explicit release process for independently versioned Stream
Deck plugins. Maintainers can publish repeatable release candidates from any
chosen commit and deliberately mark a tested version as stable without changing
the plugin version for every iteration.

This process distributes installers through GitHub Releases. A stable GitHub
Release does not imply submission to the Elgato Marketplace.

## Release model

Releases are started manually through `workflow_dispatch`. The workflow accepts:

- a Git ref, defaulting to `main`
- a plugin selection consisting of one name, comma-separated names, or `all`
- a release kind, defaulting to `rc`, with `stable` as the other choice
- optional release notes

The workflow discovers releasable plugins from the repository instead of
maintaining a hardcoded package list. A releasable plugin is an `apps/*`
directory with a `package.json` and exactly one `*.sdPlugin/manifest.json`.

The committed versions are authoritative. The release workflow never edits or
increments versions. Version changes happen separately in normal reviewed pull
requests when maintainers decide that a plugin needs a new product version.

## Release identities

Each plugin receives its own GitHub Release and installer asset.

For a release candidate, the workflow derives Git's unambiguous short form of
the checked-out GitHub commit with:

```sh
git rev-parse --short=7 "$GITHUB_SHA"
```

Git may extend the abbreviation beyond seven characters to keep it unique. The
release candidate tag is:

```text
<plugin>@<version>-rc.<short-sha>
```

For example:

```text
audio-source@0.1.0-rc.edb0c41
```

GitHub marks this release as a prerelease. Its installer retains the committed
Stream Deck manifest version, such as `0.1.0.0`. Multiple release candidates may
therefore share a manifest version; they are intended for explicit, manual
side-loading rather than automatic upgrade ordering.

A stable release uses:

```text
<plugin>@<version>
```

For example:

```text
audio-source@0.1.0
```

GitHub publishes it as a normal release rather than a prerelease. A maintainer
promotes a tested commit by rerunning the workflow for that exact ref and
selecting `stable`. The workflow rebuilds the commit instead of copying an
earlier release asset, so the stable artifact is independently verified.

## Validation and immutability

Before building a selected plugin, the workflow verifies that:

1. the selection resolves to a discovered plugin
2. the package version is stable semantic versioning in `major.minor.patch`
   form
3. the Stream Deck manifest version is the corresponding
   `major.minor.patch.0` value
4. the target Git tag does not exist
5. a GitHub Release for the target tag does not exist

An existing tag or release is a hard failure for both release candidates and
stable releases. The workflow never replaces a release, moves a tag, or uploads
an asset with `--clobber`. The final GitHub release-creation operation remains a
second collision guard if concurrent runs race after validation.

The repository may additionally enable GitHub immutable releases, but workflow
correctness must not depend on that repository setting.

## Build and publication flow

For every selected plugin, the workflow:

1. checks out the requested ref and resolves its full commit SHA
2. discovers and validates the plugin metadata
3. checks that the intended release identity is unused
4. builds and verifies each declared native platform
5. transfers native outputs through temporary workflow artifacts when needed
6. stages native outputs and packages the `.streamDeckPlugin` installer
7. creates the plugin-specific GitHub Release and attaches the installer

Selecting multiple plugins starts the same independent process for each one.
GitHub Releases are not a transaction: a later plugin failure does not roll back
an installer that another plugin already published successfully. Rerunning the
workflow should select only the unpublished plugins because published identities
are immutable.

GitHub's repository-wide `Latest` designation is not used as the source of truth
for plugin versions. Each plugin's canonical stable version is identified by its
namespaced stable tag.

## Release notes

Release notes are optional and are not a release gate. When supplied, the same
operator-provided notes apply to all selected plugins. When omitted, the workflow
uses a compact default containing the plugin name, version, release kind, and
source commit.

The workflow does not require Changesets or committed changelog entries. It also
does not generate package-scoped notes from the repository-wide commit range.

## Failure behavior

Invalid plugin names, malformed versions, package/manifest version mismatches,
existing identities, build failures, validation failures, missing native
outputs, and missing installers stop publication for the affected plugin.

A release is created only after its installer has been produced successfully.
The workflow must not create an empty published release and fill it later.

## Changesets disposition

Changesets does not participate in this release model. The implementation should
remove its commands, configuration, empty release metadata, and documentation so
the repository presents one release policy. Package versions remain independently
maintained in their existing package manifests.

## Verification

Automated tests cover plugin discovery, selection parsing, RC and stable tag
construction, canonical short-SHA handling, package/manifest version validation,
and rejection of duplicate identities.

Workflow validation covers single-plugin, multi-plugin, and `all` matrices,
native and non-native plugins, optional notes, and both release kinds. Existing
focused package, release-planner, formatting, linting, type-checking, and test
checks remain required for changed files.

## Out of scope

- Elgato Marketplace submission
- automatic version selection or incrementing
- automatic releases on pushes to `main`
- SemVer `alpha` or `beta` version state machines
- automatic upgrade ordering between release candidates
- a repository-wide combined plugin release
- overwriting or repairing an already published release
