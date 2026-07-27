# Plugin releases

## Version plugins

Plugin versions are independent and are changed explicitly in normal reviewed
pull requests. Keep `package.json` `major.minor.patch` synchronized with
manifest `major.minor.patch.0`.

Choose the semantic version change from the plugin's user-visible impact:

| Change  | Use for                                                        |
| ------- | -------------------------------------------------------------- |
| `patch` | Fixes and compatible internal improvements                     |
| `minor` | New compatible user-facing functionality                       |
| `major` | Breaking behavior, settings, or platform compatibility changes |

Shared workspace packages are not released independently. When a shared change
affects a plugin, update that plugin's version explicitly in the same reviewed
pull request.

## Start a release

Run the `Release plugins` workflow manually. Select a Git ref, one or more
dynamically discovered plugins (or `all`), `rc` or `stable`, and optional notes.
The workflow resolves the selected ref to a commit, validates every selected
plugin and version before building, and packages only the requested plugins.

For each selected plugin, the workflow builds declared native outputs on their
supported runners, transfers those ignored outputs as temporary artifacts,
stages and validates them inside the plugin package, and creates the installer.
Each plugin publishes after its own installer succeeds. A multi-plugin dispatch
can therefore publish some plugins even if another plugin fails. Rerun by
selecting only identities that have not already been published.

## Release candidates

RCs use `<plugin>@<version>-rc.<short-sha>`, are GitHub prereleases, and retain
the committed manifest version. They are manually side-loaded and do not provide
automatic upgrade ordering.

Use an RC to distribute a commit-specific installer for testing without
changing the plugin's committed version solely for the candidate. If another
candidate is required from a different commit, dispatch the workflow at that
new ref; its short SHA gives it a distinct release identity.

## Stable releases

Stable releases use `<plugin>@<version>` and are normal GitHub Releases. Stable
means canonical on GitHub, not submitted to the Elgato Marketplace.

Dispatch `stable` only after the reviewed package and manifest versions identify
the intended canonical release. Marketplace submission, review, and update
distribution remain separate from this repository workflow.

## Immutability

Existing tags and releases are never replaced. A duplicate identity fails
before publication.

This applies to both RC and stable identities. Re-running a dispatch with an
already published tag does not overwrite its installer, notes, tag, or GitHub
Release.

## Native plugin contract

Native plugins declare `release.nativePlatforms` and package-owned
`release:native` and `native:stage` scripts:

```json
{
    "release": {
        "nativePlatforms": ["macos", "windows"]
    },
    "scripts": {
        "release:native": "node scripts/release-native.mjs",
        "native:stage": "node scripts/stage-native.mjs"
    }
}
```

Supported platform names remain `macos` and `windows`; release-native output
stays under `.native/<platform>/`, and staging copies and validates the complete
platform set inside the plugin package.

The package-owned `release:native` task builds and verifies release-quality
output for the current host. The package-owned `native:stage` task receives all
declared platform outputs, copies them into the `.sdPlugin` package, and
validates the staged boundary before packaging. Turbo orchestrates those tasks
without owning plugin-specific compiler or staging details.

Plugins without native code omit `release.nativePlatforms`, `release:native`,
and `native:stage`. They use the same manual selection, validation, packaging,
and GitHub Release flow without native build jobs.

## Artifact ownership

Native executables, compiler output, staged files, and installers remain ignored
build products. Temporary native transfer artifacts retain one-day storage,
while final installers belong to their plugin-specific GitHub Releases. Normal
CI does not build release-native output, package installers, or publish
releases.
