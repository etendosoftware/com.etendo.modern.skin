# verify

Checks for the skin. `check-source.mjs` reads the files; the rest drive a running instance with
Playwright.

| File | What it does |
| --- | --- |
| `check-source.mjs` | Source gates (JSMin, CSS scope, `url()`, core contract). No browser. |
| `record.mjs` | Logs in, puts the app in each state with `drive.js`, measures it with `capture.js`, and writes `recordings/<prefix>-<screen>.json` and `shots/<prefix>-<screen>.png`. |
| `check-dom.mjs` | Asserts the design findings F1-F13 (`feedback.md`, thresholds in `criteria.json`) against `recordings/after-*.json`. |
| `check-nav.mjs` | Asserts what the side navigation opens, and that popups draw no panel. |

The screens are `grid`, `form`, `new` and `rail` on Sales Invoice opened from its menu entry, and
`login`. `recordings/before-*` and `shots/before-*` are the stock skin as the critique saw it; they are
history and are not re-recorded.

## Running

Against a local instance with the skin deployed (`./gradlew smartbuild`, see DEVELOPMENT.md), and
any Playwright install (`npm i -g playwright`, or the one `npx playwright` caches):

```sh
node verify/check-source.mjs
node verify/record.mjs   --playwright <path to playwright> [--base http://localhost:8080/etendo] [--channel chrome]
node verify/check-dom.mjs
node verify/check-nav.mjs --playwright <path to playwright> [--base http://localhost:8080/etendo] [--channel chrome]
```

`--playwright` is the path to the package (its `index.mjs`) when it is not resolvable as
`playwright`. `--channel chrome` uses the installed Chrome instead of Playwright's own browser.
Credentials come from `ETSKIN_USER` / `ETSKIN_PASSWORD` and default to `admin` / `admin`.

Each recording carries the SHA-256 of the skin files the browser was served, and `check-dom.mjs`
re-hashes the working copies (finding `P`): record again after any change to `web/`, and deploy the
branch you are on before recording, or the check refuses the recordings.

## Reading the result

The thresholds are the ones the critique was written with, against Etendo GO. Since ETP-6245 the
reference is the new UI (`workspace-ui` on `main`), and some assertions fail on values the skin takes
from it on purpose. Those are listed under `known` in `criteria.json`, with the reasons in the main
README (*Known differences from the design findings*), and are reported as `KNOWN`: the run passes
when nothing else fails. A known assertion that starts passing is flagged so its entry can go.
