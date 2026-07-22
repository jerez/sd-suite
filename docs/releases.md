# Plugin releases

This guide defines how maintainers version and release Stream Deck plugins from
the monorepo. Plugins are versioned independently. A release contains only the
plugins selected by reviewed Changesets.

## Declare a shipped change

Run this command from the workspace root before opening or updating a pull
request that changes shipped plugin behavior:

```sh
pnpm changeset
```

Select each affected plugin and choose its semantic version bump:

| Bump    | Use for                                                        |
| ------- | -------------------------------------------------------------- |
| `patch` | Fixes and compatible internal improvements                     |
| `minor` | New compatible user-facing functionality                       |
| `major` | Breaking behavior, settings, or platform compatibility changes |

Shared workspace packages are not released independently. If a shared-package
change affects one or more plugins, select those plugins in the Changeset.

## Prepare a version pull request

When pending changes are ready for release:

1. Create a branch from current `main`.
2. Inspect the pending release plan:

    ```sh
    pnpm release:status
    ```

3. Apply the version plan:

    ```sh
    pnpm release:version
    ```

4. Review the package versions, plugin changelogs, consumed Changesets, and
   Stream Deck manifest versions.
5. Commit the generated version changes and open a normal pull request.

`release:version` converts a package version such as `1.2.3` to the Stream Deck
manifest version `1.2.3.0`. The version pull request runs the same CI checks as
other pull requests. Merging it is the explicit release authorization.

## What happens after merge

The `Release plugins` workflow compares the pushed range on `main`. It selects
only plugin packages whose `package.json` version increased. A source change or
dependency change without a plugin version increase produces an empty release
plan and no release.

For each selected plugin, the workflow:

1. Builds release-native outputs on each declared platform through Turbo.
2. Transfers the ignored native outputs between jobs as temporary workflow
   artifacts.
3. Stages native outputs when required and packages the plugin through Turbo.
4. Creates a GitHub Release tagged `<package>@<version>`.
5. Attaches the `<plugin-uuid>.streamDeckPlugin` installer to that release.

The tag is created only after packaging succeeds. Re-running a completed release
replaces the installer asset instead of creating a second release.

## Native plugin contract

A plugin that ships compiled native code declares its release platforms in its
package manifest:

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

Supported platform names are `macos` and `windows`. The `release:native` task
must build and verify release-quality output for the current host under
`.native/<platform>/`. The `native:stage` task must copy the complete set of
downloaded platform outputs into the `.sdPlugin` package and validate the staged
boundary.

Plugins without native code omit `release.nativePlatforms`, `release:native`,
and `native:stage`. They use the same generic package and GitHub Release job.

## Artifact ownership

Generated native executables, compiler output, staged native files, and
`.streamDeckPlugin` installers are build products. Keep them ignored. The release
workflow uses one-day intermediate artifacts for native job transfer and stores
the final installer on the corresponding GitHub Release.

Normal CI never compiles native executables, stages release binaries, packages
installers, creates tags, or uploads release artifacts.
