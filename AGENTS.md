# AGENTS.md

Repo-local instructions for agents working in `dsh-skill-catalog`.

## What this repo is

A personal fork of [`dsh-skill-picker`](https://www.npmjs.com/package/dsh-skill-picker) v0.5.28,
renamed to `dsh-skill-catalog` so that an upstream upgrade can never overwrite local changes
(the update resolver looks the package up by `name` in the npm registry; this fork is not
published there, so it is unreachable).

It adds, over the upstream feature set: full-catalog skill discovery (disk scan merged with the
host registry) and a Chinese annotation map applied at the display layer only.

## Layout

- `plugin/` — the Git-tracked source of truth for this repo; edit here first (see below)
- `docs/agents/` — configuration the engineering skills read
- `backup/` — local rollback copies, not committed

## The one rule that matters

**`plugin/` is the Git-tracked source of truth — but it is not what runs.** The copy DSH
loads lives at `E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\`, and the copy
that produces it is `E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog\` — the
profile pins the plugin as `file:local-plugins/dsh-skill-catalog`, so `pnpm install` copies
that directory over `node_modules`. Editing only `node_modules` therefore gets reverted by
the next install. Change `plugin/`, then push it down both layers (commands below).

## Three copies — keep them in sync

| Copy | Role |
| --- | --- |
| `E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\` | what DSH loads |
| `E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog\` | the `file:` dependency source; `pnpm install` copies it over `node_modules` |
| `plugin/` in this repo | Git-tracked source of truth; edit here first |

The profile pins this plugin as `file:local-plugins/dsh-skill-catalog`, so
`dsh-plugin-update` reports `blockedReason=source-install` and never upgrades it.

This profile uses `nodeLinker: hoisted`, so pnpm **copies** a `file:` dependency rather
than hard-linking it — the two directories are independent inodes. Editing only
`node_modules` therefore really does get lost on the next install. See `CONTRIBUTING.md`
for the fuller sync discipline, including the `.map` build-artifact caveat.

**Edit `plugin/` first, then push it to the other two.** Changing only
`node_modules` gets reverted by the next `pnpm install`, because `local-plugins`
is the source of truth for that dependency.

Push `plugin/` down to the authoritative copy, then let pnpm propagate it:

```powershell
robocopy "E:\agent work\skill管理插件\plugin" `
         "E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"
node "E:\dsh-home\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs" install --dir "E:\dsh-home\profiles\desktop"
```

If you instead edited `local-plugins` directly (e.g. a hotfix on the running machine), pull
it back into `plugin/` and commit, or the next clone loses it:

```powershell
robocopy "E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog" `
         "E:\agent work\skill管理插件\plugin" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"
```

## No build chain

`build.mjs` was removed upstream and `esbuild` is not installed, so `plugin/src/` and
`plugin/lib/` are two hand-maintained copies of the same truth. Change both. `lib/` is what
runs; `src/` is the readable reference.

## Agent skills

### Issue tracker

GitHub Issues on `frzzaxszz/dsh-skill-catalog`, driven through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, label strings equal to their names. See `docs/agents/triage-labels.md`.

### Domain docs

single-context. See `docs/agents/domain.md`.
