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

- `plugin/` — the plugin source as it runs in DSH's `node_modules`
- `docs/agents/` — configuration the engineering skills read
- `backup/` — local rollback copies, not committed

## The one rule that matters

**`plugin/` is a backup, not the live copy.** The copy DSH actually loads is
`E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\`. After changing the running
plugin, sync it back into `plugin/` and commit, or the next reinstall loses the work:

```powershell
robocopy "E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog" `
         "E:\agent work\skill管理插件\plugin" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"
```

## Three copies — keep them in sync

| Copy | Role |
| --- | --- |
| `E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\` | what DSH loads |
| `E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog\` | the `file:` dependency source; `pnpm install` copies it over `node_modules` |
| `plugin/` in this repo | Git backup |

The profile pins this plugin as `file:local-plugins/dsh-skill-catalog`, so
`dsh-plugin-update` reports `blockedReason=source-install` and never upgrades it.

**Edit `plugin/` first, then push it to the other two.** Changing only
`node_modules` gets reverted by the next `pnpm install`, because `local-plugins`
is the source of truth for that dependency.

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
