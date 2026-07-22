# Changesets

Add a changeset to each pull request that changes shipped plugin behavior:

```sh
pnpm changeset
```

Select only the affected plugin packages and choose the semantic version bump
that describes the user-visible change:

- `patch`: fixes and compatible internal improvements
- `minor`: compatible user-facing functionality
- `major`: breaking behavior, settings, or compatibility changes

Shared workspace packages are not released independently. When a shared change
affects a plugin, select the affected plugin in the changeset.

When pending changes are ready for release, run `pnpm release:version` on a new
branch and open the resulting version changes as a normal pull request. Merging
that reviewed pull request authorizes the generic release workflow.
