# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

`com.etendo.modern.skin` is an Etendo Classic module (OB3 / SmartClient v10.0d) that restyles
the stock UI to look like the new Etendo UI. It contains CSS, ES5 JavaScript, three Java
providers and its own dictionary rows (prefix `ETMSK`). It must never edit Etendo Core.

Read [README.md](README.md) for how the skin works, and [DEVELOPMENT.md](DEVELOPMENT.md) for the
setup and the workflow. The backlog is the Jira epic ETP-5915.

## Hard rules

- **ES5 only** in `web/**/*.js`. The file is concatenated into the global bundle and minified with
  JSMin; one syntax error takes the whole application down.
- Every application CSS rule is scoped under `.etskin-on` (the boot screen and the login page are
  the documented exceptions). Every script stands down unless `OB.ETSkin` exists.
- Do not hide stock toolbar icons with prefix matches: list them by name.
- No parentheses inside `url()` in the CSS.
- No changes to Etendo Core files. If a task seems to need one, stop and say so.
- Keep the README in sync when behaviour, configuration or a core hook changes.

## Git conventions (Git Police)

- Branches: `feature/ETP-XXXX`, `epic/ETP-5915`, `hotfix/ETP-XXXX`.
- Commits: `Feature ETP-XXXX: <description>`, first line 80 characters max. Measure it before
  committing. Do not add `Co-Authored-By` lines.
- PRs go to `develop` (or `epic/ETP-5915`). The PR title uses the same prefix as the branch.
