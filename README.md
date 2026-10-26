# Etendo Modern Skin - shell

The visual shell of Etendo Classic (OB3 / SmartClient), and nothing else: the theme runtime and its
tokens, the side navigation, the top bar, the toolbar, forms, grids, the stylesheet they share, the
fonts, and the login page. It restyles the stock UI without replacing the stock skin and without
editing core. The palette is chosen by configuration, not by editing CSS.

> **Status:** in use on Etendo Classic 26.2.10 with Core as a JAR. This package is the module at
> commit `332c223` of its repository: the source, its dictionary rows and its web resources. See
> [Installing](#installing).

> **Contributing:** see [DEVELOPMENT.md](DEVELOPMENT.md) for the local setup, the edit/build loop and
> the Git conventions. The backlog is the Jira epic ETP-5915.

## What is in it, and what is not

Extracted from `com.etendoerp.skin.modern` at commit `3efdd3a51ed827b38af3af97e993eaae34ed4b42`.
The shell came across; four application screens did not, and belong to modules of their own: a
workspace dashboard, a point of sale, a sales order board and a Copilot dock. Their scripts, their
stylesheet sections, their views and their menu entries are not here, and nothing here loads them.

The stylesheet was cut by what its rules select and who produces it, not by where they sat. Every
`etskin-` class left in `etendo-skin.css` is one a script of this module emits; the one exception,
`etskin-nav-section-title`, was already a rule nothing emitted before the extraction. Copilot's chip
in the top bar left with Copilot: the tray is shell, but the `copilot` role is the one an application
passes to it.

The applications build on what this module publishes, so a module that carries one of them should
depend on this one:

| Contract | What it is |
| --- | --- |
| `OB.ETSkin` | Published by `etendo-skin.js` when the skin is on. Every script, here or in an application, stands down without it. |
| `OB.ETSkin.tokens` | The resolved palette. |
| `OB.ETSkin.statusBadge(value, label)` | The document status badge: five tones, one rule each. The grid uses it, and so does any screen that shows a status. |
| `OB.ETSkin.topBar` | `{ tray, chip, first }` - `chip(wrapper, role, active)` dresses a navigation bar button as one of the tray's icon chips, marked `etskin-tray-chip` so it keeps the round shape without the shell naming its role. A module that passes a role ships the icon for it. |
| `OB.ETSkin.labels`, `OB.ETSkin.navIcons`, `OB.ETSkin.trayCreateNew` | Optional overrides. Nothing here defines them; every read falls back to a default. |
| The `--sk-*` tokens and the `.etskin-on` gate | The whole palette as CSS custom properties, and the class that switches the skin on. |

## How it is put together

| Piece | What it does |
| --- | --- |
| `src/com/etendo/modern/skin/SkinComponentProvider.java` | Registers the stylesheet and the six shell scripts with the kernel resource pipeline, in that order. |
| `web/com.etendo.modern.skin/css/etendo-skin.css` | The whole application skin, authored against CSS custom properties. |
| `web/com.etendo.modern.skin/js/etendo-skin.js` | Resolves the palette per session and writes the custom properties onto `<html>`. Also overrides the SmartClient sizes that live in JS rather than CSS, and publishes `OB.ETSkin`. |
| `web/com.etendo.modern.skin/js/etendo-skin-nav.js` | Builds the left navigation panel out of `OB.Application.menu`. Stands down unless the script above ran. |
| `web/com.etendo.modern.skin/js/etendo-skin-topbar.js` | Reorders the top bar and sizes its buttons. Same rule. |
| `web/com.etendo.modern.skin/js/etendo-skin-toolbar.js` | Arranges the view toolbar into three groups with one filled action, and moves the occasional ones into an overflow menu. Same rule. |
| `web/com.etendo.modern.skin/js/etendo-skin-form.js` | What a form's stylesheet cannot reach: the required marker, the link glyph, the section chevrons, the status bar title and the child panes. Also the standard windows' GO design - the Fields / Columns menu, the Filters button and the light frame; see [The standard windows](#the-standard-windows). Same rule. |
| `web/com.etendo.modern.skin/js/etendo-skin-grid.js` | What a grid's stylesheet cannot reach: the row height, the header alignment, the frozen pane and the status badge. Same rule. |
| `src/com/etendo/modern/skin/NavMenuFoldersComponent.java` | Publishes the menu ids of the session's menu folders as `OB.ETSkinMenuFolders`, a dynamic resource registered ahead of the navigation script. Core's menu gives every entry its id but no folder one; the side navigation groups the menu by these. |
| `src/com/etendo/modern/skin/LoginSignInProvider.java` | Puts the login stylesheet on the login page through the core's `SignInProvider` seam. |
| `web/com.etendo.modern.skin/css/etendo-skin-login.css` | The login page, loaded by the provider above. |
| `web/com.etendo.modern.skin/fonts/` | Inter, self hosted. Two woff2 subsets, declared by both stylesheets. |
| `src-db/database/sourcedata/` | The module's identity: its row, the `ETMSK` prefix and its two dependencies. Nothing else. |

Every rule in the application stylesheet is scoped under `.etskin-on`, a class the script adds to
the root element. Nothing is styled until the script decides the skin is on, so disabling the
preference leaves the stock appearance untouched.

### Why the palette is resolved in the browser

The generated CSS bundle is cached under a key built from the application name and the skin
version only — there is no client, organization, role or user in it (see
`StyleSheetResourceComponent#getAppNameKey`). Baking a palette into the CSS would therefore freeze
the bundle with whatever the *first* requesting user happened to have configured, and serve it to
everyone else. So the CSS ships palette-agnostic, and `etendo-skin.js` reads `OB.Properties` — which
the kernel populates from the preferences applicable to the current session — and sets the
`--sk-*` custom properties at runtime.

## Configuration

Three preferences, all set at system level by the module and overridable per client, organization,
role or user through *General Setup → Application → Preference*.

### `ETSKIN_Enabled`

`Y` (default) or `N`. Opt-out, not opt-in. Set it to `N` for a client, role or user to give them
the stock appearance back.

The skin also stands down on its own when `SKINLEG_LegacySkin` is `Y`, because `index.jsp` swaps
the entire bundle in that case.

### `ETSKIN_Theme`

A JSON object. Every key is optional.

```json
{ "preset": "indigo" }
```

```json
{ "preset": "slate", "primary": "#0f766e", "radius": "4px", "density": "compact" }
```

| Key | Values | Notes |
| --- | --- | --- |
| `preset` | `etendoNext`, `indigo`, `etendo`, `slate`, `emerald` | The base token set. Defaults to `etendoNext`. |
| `primary` | any hex colour | Selection, links, focus rings, the active child tab. |
| `accent` | any hex colour | Toolbar action buttons, required-field markers. |
| `marker` | any hex colour | The bar down the edge of the focused view. |
| `danger` | any hex colour | Errors. |
| `surface`, `canvas`, `canvasTint`, `text` | any hex colour | The four neutrals. `canvas` is the top of the desk gradient, `canvasTint` the bottom. |
| `radius` | any CSS length | Corner radius for fields, buttons and cells. |
| `density` | `compact`, `comfortable`, `spacious` | Row height, field height and tab bar height. |
| `font` | any CSS font stack | Defaults to Inter, which the module ships, with a system fallback. |

Keys not given fall back to the preset, and an unknown preset falls back to `indigo`. A malformed
value leaves the whole theme at its defaults rather than half-applying.

Contrast is derived, never configured: `--sk-on-primary`, `--sk-on-accent` and `--sk-on-danger` are
computed from the relative luminance of the colour they sit on, so a light `primary` flips its
label to black without the administrator having to know that.

`etendoNext` is the default and the reference look: it restates the palette of Etendo's React skin
(`demo.etendo.cloud`) in Classic's vocabulary — a periwinkle desk fading to near white, the windows
as white sheets laid on it, a near-black action pill, blue for selection, and the familiar yellow
kept for the focus marker.

The `etendo` preset restates the stock Classic colours as tokens instead. It is the low-risk
rollout step — modern geometry, typography and icons, familiar colours.

### `ETSKIN_Navigation`

`sidebar` (default) or `topbar`.

`sidebar` moves the application menu out of the *Application* dropdown in the navigation bar and
into a permanent panel down the left, the way Etendo's React skin presents it, and hides the
dropdown so the menu is not in two places. `topbar` leaves the stock navigation entirely alone —
the panel is never built and the dropdown is never touched.

Anything else is read as `topbar`, so a typo costs the panel rather than the application.

See [The navigation panel](#the-navigation-panel) for what it does and what it deliberately does
not do.

### Shared configuration

The three preferences above are **shared configuration**, not this module's. Administrators set them
per client, organization, role and user, and every one of those values is a row of its own found by
the property name. This module reads them by those names and changes none of them.

Their definitions - the three entries in the core's *Property Configuration* list and the three
system-level seeds - belong to `com.etendoerp.skin.modern`, and keep belonging to it in the
transition, so this module ships no copy of them: a second definition would duplicate
the list values, and one under new ids would orphan the system-level values. On an installation
without `com.etendoerp.skin.modern` - a fresh one, for instance - a preference nobody has set reads
as its default: the skin on, the `etendoNext` preset, and the side navigation.

### The login page

The login page is not served by the kernel — `org.openbravo.erpCommon.security.Login` renders
`Login.html` through XmlEngine — so `SkinComponentProvider` cannot reach it. The stylesheet gets
there through the one seam the core offers: `org.openbravo.erpCommon.security.SignInProvider`, a CDI
interface whose implementations `Login` iterates, writing their HTML into the `sign-in` parameter
that `Login.xml` declares and `Login.html` anchors on a `<DIV id="sign-in">`.

`LoginSignInProvider` returns one `<link>` and nothing else: no script, no data, no request of its
own, and no database read. The seam is named for alternative sign-in buttons, which is what it was
built for; a stylesheet is not one, and that is the compromise this takes. The alternative is
editing a core template, which a core refresh silently reverts.

**The login theme is global and fixed.** The page runs before authentication, so there is no client,
organization, role or user to resolve `ETSKIN_Enabled` or `ETSKIN_Theme` against, and asking would
mean a query on an anonymous request. Its tokens are the module defaults, kept in step with the
`etendoNext` preset by hand so the two pages agree.

The brand panel is painted, not populated: the page's own empty `.header` div carries the mark as a
background, using the same image the boot screen uses. Nothing is inserted into the markup beyond
the link, and no JavaScript runs.

**To withdraw it**: delete `LoginSignInProvider.java` and, if the sheet is no longer wanted,
`etendo-skin-login.css` with it. The page returns to stock and nothing else in the module refers to
either. This integration is not approved for production until it has been seen working on a real
instance.

## Core changes

**None.** No file of Etendo Core is edited, included or shipped by this module. The application skin
is registered through `ComponentProvider`, and the login page is reached through `SignInProvider`.

## Typography

Inter is bundled rather than pulled from a CDN: an ERP is routinely installed behind a firewall,
and a webfont that fails to load is a skin that silently renders in the platform UI font. Inter 20
is a variable font, so the four weights this skin uses cost one file per subset, not four:
`latin` at 48 kB and `latin-ext` at 85 kB, the second gated behind `unicode-range` so it only
downloads for a page that needs the accented ranges.

Both stylesheets reference the files as `url(./../fonts/...)`. That form is deliberate. The
application stylesheet is served from inside the kernel's concatenated bundle, whose own URL is a
servlet and not this directory, so a relative path would resolve against the servlet; the kernel
rewrites the `./` prefix to the module web directory of the file that contained it
(`StyleSheetResourceComponent`, "repair urls"). The same string is also correct for the login
stylesheet, which is linked straight from its `css` directory.

## Layout notes

SmartClient positions every pane absolutely, with inline `left`/`top`/`width`/`height` it has
already measured. Nothing here can add a margin or a border to a pane without moving something the
framework is counting on, so the sheet-on-a-desk look is built out of things that cost no layout:

- The desk gradient is painted once, on `.OBTabSetMain`, and every pane between it and the content
  is transparent. Painting it per pane instead gives a flat slab of the strong end of the gradient
  wherever a pane happens to start.
- The sheet is not inset. It gets rounded top corners and the canvas shows through around the tab
  strip, which reads the same at a glance.
- The React skin's chips do not transfer to the workspace list: SmartClient sizes those rows to the
  column rather than to their text, so a filled pill becomes a full-width lozenge with the drag
  handle and the add button sitting outside it.
- They do transfer to the child tab strip, which is the one place a pill is affordable: those tab
  buttons are sized to their own title. Even there the pill is a `::before` inset inside the
  button, because the button itself carries an inline `width` and `height` SmartClient measured -
  a margin would move it and a border would grow it.
- The two strips are marked differently, following the reference: the selected *window* tab is a
  white sheet with the accent along its bottom edge, while the selected *child* tab is marked only
  by being the lightest of three fills over the band. Neither uses a colour change on the label.

### The navigation panel

Everything the panel needs is already in the browser. `OB.Application.menu` is the complete menu
tree for the session, emitted by core's `application-menu.js.ftl`, and
`OBApplicationMenuTree#itemClick` is already the code that turns one of its nodes into an open
view. Windows, classic windows, process definitions, reports, forms, external links and recents
each open differently, and that function is where core encodes the differences — so the script
renders the tree and delegates every click to one hidden instance of that class rather than
restating any of it. Nothing here is a server round trip, and nothing here is a copy of core logic
that would drift.

- **One canvas of HTML, not a widget tree.** SmartClient positions every canvas absolutely from
  measurements it takes itself, so this menu's 277 nodes would be 277 widgets to lay out and to
  argue with about styling. One `isc.Canvas` of markup costs a single layout pass, is scrolled by
  the browser, and can actually look like the reference. It is also the only part of this module
  whose class names are ours, so it needs no attribute matching and no specificity games.
- **`redrawOnResize: false` is load-bearing.** The open folders, the scroll position and the search
  text live in the DOM. SmartClient redraws a canvas on every resize by default, which would
  rebuild the markup from `contents` and lose all three.
- **The tab set is re-sized on the way in.** It was built for a `VLayout`, where `width: '100%'`
  meant "as wide as the parent". Inside the new `HLayout` width is the length axis, so `'100%'`
  would push it off the right edge by exactly the width of the panel; SmartClient's `'*'` — take
  what is left — is the intent. Height becomes the breadth axis and does stretch, so it goes to
  `'100%'`.
- **Clicks are handled on `document`, in the capture phase.** SmartClient stops a good deal of what
  happens inside its own canvases, and a listener bound to the canvas handle would not survive a
  redraw. The search input additionally stops `mousedown`, which is what stops SmartClient's event
  handler taking focus off it mid-keystroke.
- **The stale window class is cleared before every delegated click.** A window that is in
  development emits a generated class name of its own and records it in
  `OB.Layout.ViewManager.loadedWindowClassName`, which core never clears again; `fetchViewCallback`
  in `ob-view-manager.js` then lets that name override the view it has just fetched. The visible
  effect is that the first click on any other entry - the one that has to fetch, since the second
  finds the class already defined - opens a tab with the right title and the *last development
  window's grid* inside it. `delegateClick` sets the global back to null on the way in, which is
  strictly more correct: a fetch that really is a development window sets it again from its own
  response.
- **The panel stands down in a popup.** A popup carries its own layout, shows one process or one
  classic form and cannot navigate anywhere, so a 240px menu there is dead weight in a deliberately
  small window. Popups are recognised by all three shapes core opens them in: the `hideMenu=true`
  it appends to classic window, help and popup urls; the `PROCESS` window name
  `OB.Utilities.openProcessPopup` gives the window it opens; and the opener any `window.open` leaves
  behind, which a plain tab does not.
- **Hiding the stock dropdown is the last thing `install` does.** If any earlier step throws, the
  panel is missing but the *Application* menu is still in the navigation bar, so the user still has
  a menu.
- **Core's words first, the dictionary for the rest.** The search box's placeholder and the recents
  heading reuse core labels (`OBUIAPP_CalWidget_Filter`, `OBKMO_RecentViews`). The group and
  category names have no core counterpart, so they are skin words in the dictionary - see
  [Groups and categories](#groups-and-categories) - never English literals on their own.

Filtering is two classes: one on the root, which opens every subtree so a match four levels down is
visible without expanding anything, and one on each group that contains no match, which takes it
out of the flow. Clearing the box drops both and the panel is back to whatever the user had open —
the expanded state is never thrown away.

The look follows Etendo GO's side navigation, measured from its own markup: 240px open and 56px
collapsed, a `#f6f7f9` panel with a `#e1e7ef` edge, 32px rows, thin 20px glyphs on the sections
only, and every label starting at 52px. The entries of a section hang from a guide line at 33px —
under the section's glyph — and each deeper level adds 16px, with a line of its own. The open entry
is a `#ffd900` band from its guide line to 8px short of the edge; a section holding it is filled
yellow while closed and keeps a 3px yellow start border while open. Those four colours are the
`--sk-nav-*` tokens, kept apart from the palette presets and from `--sk-marker`. The recent views
are rows under the same guide line rather than chips, under two discreet group titles that reuse
core labels (`OBKMO_RecentViews` and `UINAVBA_APPLICATION_MENU`). Only one section is open at a
time, as in GO: opening a section folds the one that was open, while folders inside a section keep
whatever the user left open. GO's collapsed rail opens a flyout on hover; Classic's tree is up to
four levels deep, so a tile keeps expanding the panel onto its section instead.

Collapsed, the panel becomes a 56px rail of the *top level only*. Railing every level would be four
depths of identical glyphs with no titles, which is why the first version of this hid the tree
outright; railing one level is a different thing, because the nine or so sections of an Etendo menu
are few enough to be recognised and the tile for the section containing the open view is marked, so
the rail still answers "where am I". Clicking a tile expands the panel, opens that section and
scrolls it into view; the search box expands the panel and takes focus. The choice is remembered in
`localStorage`, per browser, wrapped in try/catch because a private window throws.

A tile shows a two-letter monogram taken from the section title — first letters of the first two
significant words, stopwords in English and Spanish skipped, a single-word title contributing its
first two letters. Monograms rather than shipped artwork, because **a folder node in
`OB.Application.menu` carries no id**: its keys are exactly `title`, `singleRecord`, `readOnly`,
`editOrDeleteOnly`, `type` and `submenu`. There is nothing stable to key an icon table on except the
translated title, and the menu is data — a client can rename a section or add one. A monogram is
derived from whatever the title happens to be, so it is always present, correct in every language
and works for third-party sections. Collisions are possible (*Procurement Management* and
*Production Management* both give `PM`); each tile carries the full title as its tooltip.

Real artwork drops in without a rework. If `OB.ETSkin.navIcons` exists, the renderer reads
`navIcons[title]` for each top-level node and emits that as an `<img>` in place of the monogram, in
the rail and in the expanded row alike. Populating it needs no core change: this module's own
`ComponentProvider` can register a generated `.js.ftl` resource that reads `AD_MENU` (joined to
`AD_MENU_TRL` for the session's language, which is the same text the menu itself was built from) and
emits `OB.ETSkin.navIcons = {"<title>": "data:image/png;base64,…"}`. Top-level titles are unique
within a menu, so the title is a sound key on the server side too.

Two things it deliberately does not do in this version. It does not scroll the current view into
sight or expand the folders above it on every tab switch: the mark climbs to the nearest folder on
screen instead - the section itself when it is closed - which points at the open view without
fighting a user who just collapsed that folder. And it
matches the open tab to a menu row by title, because a title is all a tab and a menu node reliably
share.

#### Groups and categories

The panel does not show Classic's sixteen module folders as they are. It regroups the session's own
menu the way Etendo GO lays its navigation out: five groups under small titles - General,
Commercial, Operations, Finance and System - each holding short categories (Sales, Inventory,
Accounting, Security...), and each category its windows in one flat list. The map is
`NAV_SECTIONS` in `etendo-skin-nav.js`.

- **By menu id, never by title.** A category names its sources by `AD_MENU_ID`, so the map holds in
  every language and when a client renames a folder. Entries carry their id in
  `OB.Application.menu`; folders do not, so `NavMenuFoldersComponent` publishes theirs from the
  same `MenuManager` the core template reads. If that tree is missing or does not match the menu
  entry for entry, the panel shows the stock tree.
- **Nothing added, nothing lost.** Every row is an entry of the session's menu, so the role still
  decides what appears, and a category with nothing in it is left out. A source brings its whole
  subtree; a more specific source another category claims is taken out of it (Security from General
  Setup, the EMOS Invoice Monitor from Financial Management). Whatever no category claims - a third
  party module's folder, say - goes under Other, folder and all. Deprecated is left out.
- **GO's flat lists.** A module's Transactions folder is opened into its category's list; the
  Analysis Tools and Setup folders of every source in a category are merged into one Analysis and
  one Setup group at its end; any other folder stays a group of its own.
- **Home and the recent views.** General holds Home, which selects the workspace tab, and the
  recent views. Favourites, getting started and the company switcher of GO have no counterpart in
  Classic and are not imitated.
- **The words are the dictionary's.** Group and category names are `ETSKIN_L_nav*` messages of the
  reference module, with the English written in the map as the fallback, so a translation module
  translates them like any other message.

Collapsed, the rail shows one tile per category, with a hairline between groups.

### The navigation bar

The reference puts the brand on the left and gathers everything else into a row of quiet icon
buttons on the right. Stock Etendo does the opposite - `OB.TopLayout` is `[left spacer, navbar, middle
spacer, logos]`, so the buttons lead and the logos hug the right edge - and the buttons themselves
are a row of labelled text: `Alerts (1)`, `Help`, `admin`.

Almost all of that is a stylesheet problem. Two things are not, and they are the whole of
`etendo-skin-topbar.js`:

- **Order.** The panes are absolutely positioned, so no amount of CSS reorders them. The members
  are re-ordered to `[logos, spacers, navbar]` - the *same* canvases, moved rather than rebuilt, so
  `OB.TopLayout.CompanyImageLogo` and `OB.TopLayout.OpenbravoLogo` remain the objects core handed
  out and anything holding a reference to them still works. The logo container was built to hug the
  right, so it is flipped to `left`, where it becomes the brand.
- **Measurements.** SmartClient writes `width` and `height` inline after measuring, and it measures
  a toolstrip member by what that member *draws*. The profile button is the case in point: it is
  40px wide and still measured 59, because the hidden menu arrow keeps its slot. Each button is
  therefore sized in JS and its wrapper set to `overflow: hidden`, which is what gives the row its
  even 44px pitch.

Everything else - the glyphs, the fills, the hover and selected states - is CSS.

The look follows Etendo GO's top bar, measured from its own markup: 62px on the same `#f6f7f9` as
the side navigation (`--sk-topbar-surface`) and no rule under it, so bar and panel read as one
frame. The brand column is 240px when the side navigation is on, so what follows starts over the
content. The utilities are 40px glyphs with GO's 8px corners, no surface and no shadow, a neutral
fill only under the pointer or while their menu is open; the avatar stays round, and so does any
chip another module hands to `chip()`.

Two pieces are arranged rather than restyled, and neither is a control of the skin's own:

- **The search field is the stock Quick Launch.** Its wrapper leaves the tray for the middle of the
  bar, between two spacers that split what is left evenly, and becomes GO's 44px `--sk-search-fill`
  pill. It is moved, not rebuilt: `OBQuickRun` positions its flyout from the wrapper it is in when it
  opens and marks that wrapper while the flyout is open, so both follow it, and the keyboard shortcut
  is untouched. The placeholder is the launcher's own translated tooltip, written into
  `--sk-search-label` and drawn with `content: var(...)`, which survives SmartClient's redraws.
- **The title is read, not typed.** A canvas after the brand shows the open view as GO does - 20px
  semibold with its place in the menu under it in 12px - taking the menu's name for the window
  rather than the tab's label, which changes with the selected record. A tab no menu entry opens,
  such as the workspace, keeps its own label. It follows the selected tab through the same class
  observer on the tab bar that the side navigation uses.

Widths are fitted in JS on install and on every page resize: the title takes up to 320px, the field
up to 480 and gives way first, down to 180, and the stock spacers of the bar, which are empty, are
narrowed to nothing so that the two around the field can centre it. The room is read from the bar's
parent rather than the bar, because an overflowing bar measures wider than the page.

The labels become icons. `Alerts (1)`, `Help` and the logout image get a masked glyph and lose
their text; `admin` becomes an `AD` monogram over a tinted disc, the same device the collapsed rail
uses. The glyph is drawn on the wrapper rather than on the label, because a SmartClient button is a
table and the styleName lands on the label cell, its spacer cells *and* the icon slot alike - mask
"the cell" and four overlapping copies of the icon appear, which is exactly what the first attempt
looked like.

Two behaviours are preserved rather than reimplemented. The alert count is not thrown away: core
refreshes it by calling `setTitle` with a translated `Alerts (n)`, so `setTitle` is wrapped to read
the number out, hang a red dot on the button when it is above zero and move the original string to
the tooltip - which says more than the truncated label did and costs no width. And `OBQuickRun`
swaps the wrapper's whole `styleName` when a panel opens, which would drop the marker classes, so
`setStyleName` is wrapped to re-append them.

Anything the skin does not recognise - the debug menu that `com.smf.smartclient.debugtools` adds,
for one - keeps its width and gets the glyph styling as text. That menu is added *after*
`OB.Layout.initialize`, so `OB.NavBar.addMembers` is wrapped too and late arrivals are dressed on
the way in.

### The standard windows

Every standard window of Etendo Classic - every `OBStandardWindow`, whatever its module - takes the
list, form and toolbar language of Etendo GO, first proved on Sales Order. The EMOS views are UIKit
canvases, never `OBStandardWindow`, and none of this reaches them: every rule hangs from
`etskin-go`, the class `etendo-skin-form.js` puts on a standard window's root, and no SmartClient
class or `--sk-*` token a UIKit view reads is changed.

- **The list.** 44px rows under a 40px header; the filter row is folded behind a Filters button that
  brings it back and counts the criteria in force - never the link of a child tab to its parent. The
  row is hidden, not removed, because Core reads it to know the grid is filtered and to clear it.
- **Fields and Columns.** One toolbar button offers the form's fields while the form shows and the
  grid's columns while the list shows. Any field the user's role gets can be hidden or shown,
  required ones included, and so can a whole section - a field group, or the notes, linked items,
  attachments and audit blocks - from its own row. The menu stays open through every tick. A hidden
  field goes with `hiddenInForm` and the item's own `hide()`; it keeps its value, its callouts and
  its validation. A required field that is hidden and empty, or in error, is named in the message
  bar with an action that shows it for that record only. The native personalization button, which
  in this installation only answers with the licence notice, gives way to the menu.
- **What a tab opens on.** What Core shows. The one exception is Sales Order, which keeps the first
  selection approved in its pilot, named by `AD_Tab` id. No other window gets one: which fields and
  columns matter is chosen from the interface by the team and the users. The user's choices win and live in `localStorage`, per user, role and tab: fields
  and sections under `etskin.fields.v1.*`, columns under `etskin.columns.v1.*`. They do not follow the
  user to another browser. Reset returns the tab to its first selection.
- **The toolbar and the frame.** Filters leads, New is the filled primary in the list and Save carries
  its word in the form. The desk and the window strip take the grey of the top bar and the side
  navigation whatever the tab shows - a standard window, the workspace, an EMOS view or a window still
  loading - so the strip never changes colour between tabs; a standard window is one white sheet on it.
- **The window tabs.** The selected tab keeps its close X. Core's skin draws the selected tab's icon
  in a white variant meant for its dark selected tab, so `OBTabBarButtonMain` is told not to switch
  icons on selection: same icon, same click, same close. The workspace tab has none, as in Core.

The menu's words are Spanish literals in the script for now; they become AD messages when the design
leaves the rehearsal.

### The boot screen

`index.jsp` paints a screen before any of this module's JavaScript has run: a white sheet, the word
`LOADING...` in 12px Arial and a 220x16 animated GIF. It is the first thing anyone sees, so it is
restyled here — a desk gradient, the Etendo mark and a slim indeterminate bar, with the stock text
and GIF hidden.

Three things make it unlike the rest of the stylesheet:

- **It is not scoped under `.etskin-on`.** That class is added by `etendo-skin.js`, which is the last
  resource in the bundle; by the time it runs the boot screen is nearly over. So these rules apply
  unconditionally, exactly like the login page.
- **The palette tokens therefore live on `:root`, not on `.etskin-on`.** Custom properties are inert
  until something reads them, so declaring them unconditionally costs a client that has the skin
  turned off nothing at all.
- **Everything is scoped to `#OBLoadingDiv`.** `.OBLoadingPromptModalMask` and
  `.OBLoadingPromptLabel` are not only the boot markup's classes — they are also SmartClient's
  `mainLayoutStyleName` and `loadingTextStyleName` (`ob-application-styles.js`), used for the
  *in-application* loading prompt. Styling the bare classes would repaint that too. The id is also
  what supplies the specificity: `index.jsp` repeats its own copy of these rules in an inline
  `<style>` that comes *after* the kernel's stylesheet `<link>`, so an equal-specificity rule loses.

The mask gets an explicit `z-index`. Stock leaves it at the default stacking level and only lifts
the box inside it, which holds right up to the moment `OB.Layout.draw()` starts creating canvases
with six-figure z-indexes — the half-drawn application then shows through the mask that is supposed
to be covering it.

The markup is untouched: the `LOADING...` string is hardcoded English in `index.jsp`, so replacing
it through `content:` would trade an ugly translated string for an untranslatable one. It is hidden
instead, and the bar carries the meaning.

The same art shows up a second time, inside the application: opening a window, switching to a tab
whose pane has not been built, the calendar and the branding widget all call
`OB.Utilities.createLoadingLayout`, which puts a label next to
`OB.Styles.LoadingPrompt.loadingImage` — the very GIF `index.jsp` used. That is handled in the same
place, by matching the `<img>` on its file name and replacing it with a 1x1 transparent GIF through
`content:`, which empties the element while leaving a box to paint the same bar on. Replacing it
rather than hiding it matters: `visibility: hidden` would take the background with it. Doing it in
JS was the alternative, but that would mean overriding a core function
`com.smf.smartclient.boostedui` already overrides.

There the label is kept — it is `OBUIAPP_LOADING`, so unlike the boot screen's hardcoded string it
is translated, and it is the only thing on that pane a screen reader can read.

## Conventions the stylesheet follows

- **Attribute selectors over class lists.** SmartClient class names carry combinatorial state
  suffixes (`OBGridCell`, `OBGridCellSelected`, `OBGridCellOverSelectedDisabled`, …). Prefix and
  substring matching (`td[class^="OBGridCell"][class*="Selected"]`) covers the whole family and, at
  specificity 0-2-1 against the stock 0-1-0, wins regardless of concatenation order.
- **Explicit lists where a match would hide something.** The toolbar icons are the exception: they
  are masked SVG, and masking hides the stock image, so a prefix match would blank out any icon
  this module does not define — including icons added by other modules. They are listed by name, so
  an unknown icon keeps its stock PNG.
- **No parentheses inside `url()`.** The CSS pipeline rewrites `url(` one line at a time and stops
  at the first `)`, so the inline SVG data URIs contain none.
- **Conservative ES5 in the script.** It is concatenated into the global bundle and minified with
  Crockford's JSMin; one syntax error takes the application down.

## Installing

The module depends only on Core and on the *User Interface Application* module. It edits no core
file, adds no table, column, function or trigger, and its dictionary rows are its own (its identity,
its `ETMSK` prefix and its dependencies).

1. Copy the `com.etendo.modern.skin` folder into `modules/` of the installation.
2. `./gradlew update.database`
3. `./gradlew smartbuild` (it has a Java class, so it needs compiling) and restart Tomcat.

To remove it, take the folder out of `modules/` together with what the build produced for it
(`build/classes/com/etendo/modern/skin`, `WebContent/web/com.etendo.modern.skin` and their copies in
the deployed webapp), then `update.database`, `smartbuild` and a restart: the application returns to
the stock skin, and the module's rows leave the database with it.

**What lives in another module.** The words the shell shows - the side navigation's group and
category names (`ETSKIN_L_nav*`) and a few labels of the toolbar and the grid - are read from the
dictionary as `ETSKIN_L_*` or `ETMSK_L_*` messages, and the definitions of the three
`ETSKIN_*` preferences sit in `com.etendoerp.skin.modern` (see [Shared configuration](#shared-configuration)).
Without that module the shell still works: every word falls back to the English written beside it in
the code, and every preference reads as its default.

**The side navigation map** (`NAV_SECTIONS` in `etendo-skin-nav.js`) names standard Etendo menu
folders by `AD_MENU_ID`, plus a few entries of the installation it was built on. An id an
installation does not have is simply absent; anything the map does not claim goes under *Other*.
