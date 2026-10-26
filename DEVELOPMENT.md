# Developing the Modern Skin Shell

How to set up a local environment and contribute to `com.etendo.modern.skin`. What the module
does and how it is built is in the [README](README.md); this file only covers the workflow.

The current backlog is the Jira epic **ETP-5915 - Modern Skin: production readiness**.

## Prerequisites

- A local **Etendo Classic 26.x** installation (core as JAR or in source format), with PostgreSQL
  and Tomcat, that you can `update.database` and `smartbuild`. The module was last proven on
  Etendo Classic 26.2.10.
- Node.js 18+ only if you run the benchmark or the verification scripts.
- Optional: `com.etendoerp.skin.modern` (see [Preferences](#preferences)).

## Install the module in your environment

```bash
cd <etendo-root>/modules
git clone git@github.com:etendosoftware/com.etendo.modern.skin.git
cd ..
./gradlew update.database
./gradlew smartbuild          # the module has Java classes, so it needs compiling
# restart Tomcat
```

Log in and the skin is on: with no preference set it reads as `ETSKIN_Enabled = Y`, the
`etendoNext` preset and the side navigation.

To work on the module's dictionary rows (messages, preferences, see ETP-5920), mark it
**In Development** in *General Setup > Application > Module Management* before running
`./gradlew export.database`.

## Edit, build, check

The skin is static web resources (`web/com.etendo.modern.skin/css`, `js`, `fonts`) plus three
Java classes that register them.

1. Edit the files under `web/com.etendo.modern.skin/` (or `src/` for the Java providers).
2. `./gradlew smartbuild` copies the web resources into `WebContent` and deploys them. Restart
   Tomcat when a Java class changed.
3. Hard-reload the browser (the kernel serves the CSS and JS bundle with cache headers).
4. Check the browser console: the JS is concatenated into **one global bundle and minified with
   JSMin**. A syntax error, or an ES2015+ construct, takes the whole application down, not just
   the skin.

Rules that keep the skin from breaking Classic (details in the README, *Conventions the
stylesheet follows*):

- Every application rule is scoped under `.etskin-on`. Nothing is styled until `etendo-skin.js`
  decides the skin is on. The boot screen and the login page are the only exceptions.
- **ES5 only** in `web/**/*.js`: `var`, `function`, no arrow functions, no `let`/`const`, no
  template literals, no trailing commas in calls.
- Match SmartClient class families with attribute selectors (`[class^="OBGridCell"]`), but list
  toolbar icons explicitly: an unknown icon must keep its stock PNG.
- No parentheses inside `url()`: the CSS pipeline stops at the first `)`.
- No change to Etendo Core. If something can only be reached by editing core, raise it in the
  task first.

## Preferences

The three preferences (`ETSKIN_Enabled`, `ETSKIN_Theme`, `ETSKIN_Navigation`) and the `ETSKIN_L_*`
labels are **defined** in `com.etendoerp.skin.modern` until ETP-5920 moves them here.

- **Without** `com.etendoerp.skin.modern` you get the defaults (skin on, `etendoNext`, side
  navigation) and the English fallback labels. This is the supported setup for now, and enough
  for most styling work.
- **Do not install `com.etendoerp.skin.modern` next to this module.** Since INT-7413 it seeds
  `ETSKIN_Enabled = N` at system level, which turns the shell off too. Setting it to `Y` turns on
  *both* skins: `skin.modern` ships its own copy of the stylesheet and the navigation scripts, so
  the two paint over each other.
- Testing other presets or `ETSKIN_Navigation = topbar` therefore needs the preference
  definitions in this module, which is ETP-5920. Until it lands, keep to the defaults.

Test every visual change at least with the skin **on** and with `ETSKIN_Enabled = N`: off must
give the stock look back with nothing left behind.

## Performance

The benchmark lives in `com.etendorx.workspace-ui`, `playwright-tests/perf/`:

```bash
FLAVOR=classic BASE_URL=http://localhost:8080/etendo node perf/bench.mjs
```

Compare runs with `perf/compare.mjs`. The October 2026 baselines and the current cost of the skin
(about +23% CPU on navigation with a 4x slowed CPU) are in ETP-5923.

## Branches, commits and pull requests

The repository follows the Etendo Git Police rules, checked on every pull request.

| What | Pattern | Example |
| --- | --- | --- |
| Task branch | `feature/ETP-XXXX` | `feature/ETP-5917` |
| Commit | `Feature ETP-XXXX: <imperative description>`, first line 80 chars max | `Feature ETP-5917: Style the pick and execute grid` |
| Epic branch | `epic/ETP-5915` | |
| PR title | same prefix as the branch | `Feature ETP-5917: Style process popups` |

- Branch from `develop`, open the PR against `develop` (or against `epic/ETP-5915` when the epic
  branch is in use). `main` only receives releases.
- Every PR runs **Git Police** (branch name, destination and commit format; required to merge) and
  the **Auto Reviewer** bot. Address or mark as `/false-positive` its blocking comments.
- Fill in the PR template: before/after screenshots, the preset and the navigation mode used.
