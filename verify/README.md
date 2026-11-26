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
reference is the new UI (`workspace-ui` on `main`), and several assertions fail on values the skin
takes from it on purpose: the 62px top bar and its 20px title, 32px navigation rows and grid rows,
white section card heads, one toolbar pill with its glyphs inline, the 4px gap between the top-bar
chips, and the 28px form fields. The status of each finding, and which failures are deliberate, is
recorded in ETP-5919.
