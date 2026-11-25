# Contract with Etendo Core and SmartClient

Everything this module relies on from Etendo Core (OB3) and SmartClient 10.0d without owning it:
the kernel seams it plugs into, the functions it wraps or replaces, the globals it reads, the DOM it
watches and the class names its stylesheet matches. Core is never edited (see the README,
[Core changes](../README.md#core-changes)); this list is what that promise rests on.

Use it to answer one question: **if Core, SmartClient or another module changes X, what breaks?**
It is the input for the SmartClient 14.1 adaptation (ETP-6167), the compatibility tests and the CI
smoke test.

Line numbers are those of the branch this was written on (`feature/ETP-5922`). They move; the
function names do not, so search by name.

## How a broken hook shows up

Every hook is wrapped in `try`/`catch`. A hook that fails leaves the stock behaviour in place and,
for the big ones, logs one of these to the console. Any of them after an upgrade means the hook
above it in this list no longer matches Core:

| Console warning | Hook that failed |
| --- | --- |
| `Etendo Modern Skin could not be applied` | `etendo-skin.js`: palette or SmartClient defaults |
| `... could not build the side navigation` / `... side navigation is unavailable` | `OB.Layout.initialize` (nav) |
| `... could not restyle the navigation bar` / `... navigation bar styling is unavailable` | `OB.Layout.initialize` (top bar) |
| `... could not dress a new navigation bar component` | `OB.NavBar.addMembers` |
| `... could not install the toolbar arrangement` / `... could not arrange the toolbar` | `isc.OBToolbar` |
| `... could not adjust the grid` | `isc.OBViewGrid` (grid script) |
| `... could not adjust the form titles` / `... form sections` | `isc.OBViewForm`, `isc.ImgSectionHeader` |
| `... could not title the status bar` | `isc.OBStatusBar.updateContentTitle` |
| `... could not size the child panes` | `isc.OBViewForm.setNewState` |
| `... could not install the GO windows` | Fields / Columns / Filters buttons, `OB.ViewFormProperties` |

Smaller hooks fail silently by design (a missing chevron, a missing count). They are caught by the
checks in the last column of the tables below.

## Kernel seams (Java)

| Seam | Where | What it does | If it changes |
| --- | --- | --- | --- |
| `org.openbravo.client.kernel.BaseComponentProvider`, `@ComponentProvider.Qualifier`, `getGlobalComponentResources()` | `SkinComponentProvider.java` | Adds `etendo-skin.css` and the six scripts to the global resource bundle, in order. `createStaticResource` puts them in the generated `web/js/gen/<hash>.js`. | Nothing loads: stock Classic, no console warning. Check that `OB.ETSkin` exists after login. |
| `org.openbravo.erpCommon.security.SignInProvider`, `getLoginPageSignInHTMLCode()` | `LoginSignInProvider.java` | Writes the `<link>` to `etendo-skin-login.css` into the login page. | Stock login page. Check that the stylesheet is requested on `/security/Login`. |
| `OB.Properties` (kernel, filled from the AD preferences) | `etendo-skin.js:119`, `etendo-skin-nav.js:55` | Reads `ETMSK_Enabled`, `ETMSK_Theme`, `ETMSK_Navigation`. | Skin always on with defaults, or always off. Check with `ETMSK_Enabled = N`. |
| `OB.Application.menu` (emitted per session by `application-menu.js.ftl`) | `etendo-skin-nav.js:17, 123, 169, 274, 956` | The whole menu tree the side panel is built from. Folder nodes carry only a translated title. | Empty or partial side panel. |

## Load order

The scripts run once, when the bundle is evaluated, after Core's own classes are defined:
`etendo-skin.js` first, then nav, top bar, toolbar, form and grid (`SkinComponentProvider`).
Each one stands down unless `OB.ETSkin` exists, and wraps prototypes at load time. Two consequences:

- A Core class must be defined **before** the bundle is evaluated, or its wrapper is silently skipped
  (`isc.OBViewGrid`, `isc.OBViewForm`, `isc.OBToolbar`, `isc.OBStatusBar`, `isc.OBStandardView`,
  `isc.OBTabSetMain`, `isc.ImgSectionHeader`, `OB.ViewFormProperties`).
- Two scripts wrap the same method on `isc.OBViewGrid` (`draw`, `filterData`): the form script first,
  then the grid script on top of it. Both call through, so the order only decides which runs first.

## Functions wrapped or replaced

Every wrapper calls the original unless the table says otherwise. *Replaced* means the original is not
called on that path.

### SmartClient (`isc.*`)

| Target | Where | What the skin does | If it changes |
| --- | --- | --- | --- |
| `isc.ListGrid.prototype.updateSorter` | `etendo-skin.js:401` | Makes the corner sort button's `draw` idempotent (it was drawn twice with native scrollbars: `TypeError '$123y'`). | The console errors come back on every window. |
| `isc.ImgSectionHeader.prototype.setTitle`, `draw` | `etendo-skin-form.js:189` | Adds the chevron to form section titles and tells `OBSectionItemButton` apart at draw time. | Sections without chevrons; Notes / Attachments lose theirs on recount. |

### Etendo Core classes (`isc.OB*`)

| Target | Where | What the skin does | If it changes |
| --- | --- | --- | --- |
| `isc.OBViewGrid.prototype.draw` | `etendo-skin-form.js:2104` | Before the first draw of a standard view's grid: row and header heights, folded filter row, column choice (`adaptGrid`). | Grid shows Core's columns and the filter row; on a late adapt, +70% open time on Sales Order (ETP-5923). |
| `isc.OBViewGrid.prototype.filterData` | `etendo-skin-form.js:2116` | Refreshes the count on the Filters button. | "Filters · N" stays stale after a filter change. |
| `isc.OBViewGrid.prototype.draw`, `filterData` | `etendo-skin-grid.js:400, 411` | Aligns header cells and marks the filtered state on the stock filter button. | Misaligned headers; no filtered mark. |
| `isc.OBViewGrid.prototype.updateRowCountDisplay` | `etendo-skin-grid.js:375` | **Replaced** (unless the grid has an edit-link column): refreshes the top bar title count and sets `view.recordCount` on child tabs, which Core's `updateTabTitle` already draws as "Lines (13)". | No count in the title or on child tabs. |
| `isc.OBViewGrid.prototype.checkShowFilterFunnelIcon` | `etendo-skin-grid.js:422` | Passes a fake message bar (`QUIET_BAR`, line 248) that reports itself visible, so Core skips the implicit filter banner. Depends on Core guarding with `messageBar && !messageBar.isVisible()`. | The two-line implicit filter banner comes back. |
| `isc.OBViewGrid.prototype.setSingleRecordFilterMessage` | `etendo-skin-grid.js:432` | Same trick, for the single-record message. | That banner comes back. |
| `isc.OBViewGrid.prototype.getCellValue` | `etendo-skin-grid.js:436` | Status badges; reference cells wrapped as links. Reads `field.targetEntity`, `refColumnName`, `record[field.name]`. | Plain text cells, no badges. |
| `isc.OBViewGrid.prototype.cellClick` | `etendo-skin-grid.js:454` | A click on a link opens the record with `OB.Utilities.openDirectView(windowId, refColumnName, targetEntity, id, fieldId)` (line 458) and stops there. Reads `isc.EH.lastEvent.nativeTarget` (line 330). | Links do nothing, or select the row only. |
| `isc.OBViewGrid` properties `cellHeight`, `editGrid: false` | `etendo-skin-grid.js:366, 373` | Row height; the edit-link column is never built (Core reads `editGrid` while assembling fields). | The `_editLink` column appears (`isc.OBViewGrid.EDIT_LINK_FIELD_NAME`, line 56). |
| `isc.OBParameterWindowView.prototype.buildButtonLayout` | `etendo-skin-form.js:2119` | Gives every button of a process definition's parameter window except the main one - `okButton` (Done), else `htmlButton` (a report's View), else the last of the process's own buttons - the base style `OBFormButtonSecondary`, before they are drawn, so the stylesheet can outline them. Reads `this.okButton`, `this.htmlButton` and the returned layout array. | All the buttons drawn filled, as in stock. |
| `isc.OBPickAndExecuteGrid` properties `headerHeight`, `styleName` | `etendo-skin-form.js:2169` | The process grid gets the window grid's 32px header and `etskin-go` after Core's `listGrid`, so the grid and field rules written under that class reach it in a process tab too (a popup already sits inside the window). | Stock 30px header; in a process tab, a white header and boxed edit cells. |
| `isc.OBTreeViewGrid.prototype.getTreeGridFields` | `etendo-skin-form.js:2111` | Core copies the list's columns into the tree each time it is shown (`OB.ToolbarUtils.showTreeGrid`); the first, the tree column, gets its own copy at 240px (`TREE_COLUMN_WIDTH`) so the indent, chevron, checkbox and folder leave room for the value. The list's field object is not touched. `adaptGrid` also gives `view.treeGrid` the list's row and header heights (line 1383). | Codes cut off in the tree column; tree rows back at 25px. |
| `isc.OBViewForm.create` | `etendo-skin-form.js:139` | **Static** factory wrapped: adopts every new form (title marks on the instance, lines 86, 100). | Asterisks and link glyphs fall back to stock. |
| `isc.OBViewForm.prototype.getTitleHTML` and the `*TitlePrefix` / `*TitleSuffix` properties | `etendo-skin-form.js:124` | Required marker and the link glyph's class. | Stock bold asterisk. |
| `isc.OBViewForm.prototype.setNewState` | `etendo-skin-form.js:418, 2144` | Child pane split after a new record; reapplies the Fields choice. | Lines take the whole window; hidden fields come back on New. |
| `isc.OBViewForm.prototype.setFields`, `editRecord`, `editNewRecord` | `etendo-skin-form.js:2135, 2159, 2175` | Applies the Fields choice before and after Core loads the record. | Hidden fields come back. |
| `isc.OBViewForm.prototype.showErrors` | `etendo-skin-form.js:2193` | Suppresses autofocus when the first field in error is hidden by the user. | SmartClient throws focusing a hidden item. |
| `isc.OBLinkButtonItem.prototype.getTitle` | `etendo-skin-form.js:338` | Strips Core's `[ ` and ` ]` from the titles of the Attachments section's actions (Add, Download, Remove...), only when the button sits in an `isc.OBAttachmentsLayout`. Other users of the class (alerts, pick and execute, modules) keep their brackets. | Bracketed titles inside the chips. |
| `isc.OBStatusBar.prototype.updateContentTitle` | `etendo-skin-form.js:309` | Writes the record title into the status bar (`isc.OBStatusBarTextLabel`). | No record title on the form. |
| `isc.OBStandardView.prototype.updateTabTitle` | `etendo-skin-topbar.js:385` | Root views refresh the top bar title (grid ↔ form, record change). Wrapped once, guarded by the `etskinTitled` flag on the prototype. | Stale title when opening the form on a selected record. |
| `isc.OBMyOpenbravo.prototype.createPortalLayout` | `etendo-skin-nav.js:1156` | Side navigation only. After Core builds the portal (the left column is built just before), the workspace stacks its members (`vertical`), the left column's Recent Views, Recent Documents and Manage Workspace members are hidden with their instance `show` made a no-op (Core's `setUserMode` would show them again), and the column lays Core's Refresh, Add Widget and Admin Others labels out in a row at the trailing end (`etskin-home-actions`). The portal is set to `100%` wide and `*` tall. Also `isc.OBMyOBDialog` gets `width: 280` on its prototype (line 1153). Reads `leftColumnLayout`, `refreshLayout`, `addWidgetLayout`, `adminOtherMyOBLayout`, `portalLayout`. | Stock left column beside the widgets; Recent Views shown twice. |
| `isc.OBTabSetMain.prototype.tabSelected` | `etendo-skin-form.js:2273` | Re-syncs an open Fields / Columns menu with the new window. | The menu keeps showing the previous window. |
| `isc.OBToolbar.prototype.initWidget` | `etendo-skin-toolbar.js:606` | Rearranges `leftMembers` / `rightMembers` before Core lays them out. Calls `OB.ToolbarRegistry.getButtons(tabId)` itself (line 394), as Core would. | Stock toolbar (all icons, process buttons on the right). |
| `isc.OBToolbar.prototype.addRightMembers`, `updateButtonState` | `etendo-skin-toolbar.js:617, 648` | Moves process buttons into the Actions menu; re-stamps widths and classes. | Process buttons back on the strip. |
| `isc.OBToolbar.prototype.getRightMembers` | `etendo-skin-toolbar.js:636` | **Replaced**: returns only the process buttons (`isc.isA.OBToolbarActionButton`, line 134), which is what Core's display-logic refresh expects. | Process buttons stop following display logic. |
| `isc.OBToolbar.prototype.defineRightMembersShortcuts`, `hideShowRightMembers` | `etendo-skin-toolbar.js:640, 644` | Run Core's loop against the process buttons only: Core reads `realTitle.length` and `contextView.getCurrentValues()` without guards. | `TypeError` in the toolbar on every record. |

### Core globals and instances

| Target | Where | What the skin does | If it changes |
| --- | --- | --- | --- |
| `OB.Layout.initialize` | `etendo-skin-nav.js:1173`, `etendo-skin-topbar.js:784` | Both scripts build after Core's layout exists: the side panel (moves `OB.MainView.TabSet` into a new row with `removeMember`/`addMember`, line 981) and the top bar. | No side panel, stock top bar. |
| `OB.MainView.TabSet.tabSelected` (instance) | `etendo-skin-nav.js:1061`, `etendo-skin-topbar.js:370` | Syncs the highlighted menu entry and the title. | Highlight and title lag (the `MutationObserver` below still catches most changes). |
| `OB.NavBar.addMembers` (instance) | `etendo-skin-topbar.js:623` | Dresses components added after `initialize` (e.g. the debug tools module). | One undressed button in the top bar. |
| `OB.NavBar` members: `getMembers`, `reorderMember`, `reflow`, `getVisibleWidth`, `removeMember` | `etendo-skin-topbar.js:568, 574`; `etendo-skin-nav.js:996` | Reorders the top bar, hides the stock Application menu button. | Top bar order breaks; the stock menu button stays. |
| Quick Launch wrapper `setStyleName` (instance) | `etendo-skin-topbar.js:107` | Keeps a marker class through `OBQuickRun`'s two `setStyleName` calls per flyout. | Quick Launch loses the pill style while open. |
| Alert button `setTitle` (instance) | `etendo-skin-topbar.js:156` | Empties the label (the bell is a CSS mask) and keeps the count as the unread dot. `OB.I18N.getLabel` calls it back asynchronously. | Text over the bell; no dot. |
| `OB.TopLayout.CompanyImageLogo`, `OB.TopLayout.reflow` | `etendo-skin-topbar.js:661, 765` | Moves Core's logo canvas next to "Etendo". | Logo in its stock place. |
| `OB.ViewFormProperties.handleFieldErrors`, `OB.ViewFormProperties.processFICReturn`, `OB.ViewFormProperties.setFocusInErrorField` | `etendo-skin-form.js:2320, 2340, 2365` | Core copies these onto every form at creation, so they are wrapped at the source: the hidden required fields notice and the focus on a visible field in error. After `processFICReturn` (display logic applied), `syncOrphanSpacers` (line 2210) sets to `0` the `height` of a `SpacerItem` whose nearest fields on both sides are hidden, keeps the original in `etskinHeight` to restore it, and calls `markForRedraw`. Reads `getItems()`, `Class`, `isVisible()`. | No notice; SmartClient error focusing a hidden field; a 20px gap where a hidden section's spacer was. |
| `OB.Styles.Process.PickAndExecute.gridCellHeight` | `etendo-skin-form.js:2166` | Set to 32 (`ROW_HEIGHT`) at load. `OBPickAndExecuteView` passes it as the grid's `cellHeight`, and `ob-formitem-pickeditgrid.js` sizes a grid parameter as 45 + this × `displayedRowsNumber`. | Stock 25px rows in every pick and execute grid. |
| `OB.ToolbarRegistry.registerButton` | `etendo-skin-form.js:2011, 2059` | Registers `etskinFields` and `etskinFilters` (`isc.OBToolbarIconButton`). | No Fields / Columns or Filters buttons. |
| `OB.Layout.ViewManager.loadedWindowClassName` | `etendo-skin-nav.js:791` | Cleared before every open from the side panel (a development window leaves it set and `ob-view-manager.js` reuses it). | The first open renders the last development window instead. |
| `isc.OBApplicationMenuTree.create(...).itemClick` | `etendo-skin-nav.js:1019` | The side panel opens entries through Core's own menu tree. | Clicks in the side panel do nothing. |
| Toolbar canvases `disableShortcut`, `enableShortcut`, `show`, `hide` (instances) | `etendo-skin-toolbar.js:202, 550` | No-op shortcuts for the skin's canvases; `show`/`hide` that do not draw a button moved into the Actions menu. | Buttons drawn over the logo; `TypeError` in `refreshCustomButtons`. |

## SmartClient defaults set

`etendo-skin.js` (`applySmartClient`), on class prototypes, before any instance exists:

| Class | Property | Where |
| --- | --- | --- |
| `Canvas` | `showCustomScrollbars: false` | `:451` |
| `OBGrid` | `editFailedCSSText: ''` (the stock skin's inline solid red on a cell that failed validation; the `Error` classes take over, ETP-6434) | `:457` |
| `OBViewGrid` | `cellHeight`, `recordComponentHeight` | `:459` |
| `OBTabSetMain` | `tabBarThickness`; `showTabScroller: false`, `showTabPicker: false` (the strip scrolls sideways instead, see the `wheel` row below) | `:474` |
| `OBTabSetChild` | `showTabScroller: false`, `showTabPicker: false` | `:479` |
| `OBTabBarMain` | `layoutTopMargin: 8`, `layoutStartMargin: 12`, `membersMargin: 4` (the window tabs 36px tall on the strip's floor, 12px in, 4px apart) | `:484` |
| `OBTabBarButtonMain` | `showSelectedIcon: false`, `capSize: 0` (no stock end caps; the stylesheet pads the label instead) | `:492` |
| `OBTextItem`, `OBFKFilterTextItem`, `OBEncryptedItem`, `OBClientClassCanvasItem`, ... (`TEXT_ITEMS`) | `height` | `:495` |
| `OBListItem`, `OBFKItem`, `OBYesNoItem`, `OBSearchItem`, `OBLinkItem` (`PICKER_ITEMS`) | `height`, `pickerIconWidth`, `pickerIconHeight`, `pickListCellHeight` | `:499` |
| `OBFormButton` | `height` | `:507` |
| `OBCalendar` | `getDateStyle` (a method: SmartClient's documented per-date style seam, which Core leaves returning `null`). Returns `etskin-cal-today` for today's cells in the day and week views; the month view never calls it. | `:468` |
| `OBGrid`, `OBTreeGrid` | `filterEditorDefaults.height` (`changeDefaults`) | `:513` |

A renamed class is skipped silently (`addProperties` checks `isc[className]`): the field or row keeps
its stock size.

## Other globals read

| Global | Where | Used for |
| --- | --- | --- |
| `OB.Application.contextUrl` | `etendo-skin-form.js:2382` | The absolute path of `etendo-skin-classic.css` linked into classic popups. |
| `OB.User.id`, `OB.User.roleId` | `etendo-skin-form.js:646, 1199` | `localStorage` keys of the Fields / Columns choice. |
| `OB.User.isPortal` | `etendo-skin-nav.js:67` | No side panel for portal users. |
| `OB.I18N.labels` | all scripts | Core's own labels and the `ETMSK_L_*` messages. |
| `OB.Layout.ViewManager.recentManager.getRecentValue('OBUIAPP_RecentDocumentsList')`, `OB.Layout.ViewManager.openView(viewId, recent, null, true)` | `etendo-skin-nav.js:384, 958` | Recent Documents in the side panel, opened as Core's workspace opened them (`id = targetTabId`, `command = 'DEFAULT'`). | No Recent Documents section, or a chip that does nothing. |
| `OB.PropertyStore.addListener` | `etendo-skin-nav.js:1073` | Redraws the recents when `OBUIAPP_RecentDocumentsList` changes. | The list updates only on the next open from the panel. |
| `OB.RecentUtilities.getRecentValue` | `etendo-skin-nav.js:376` | Recent views in the side panel. |
| `OB.Constants.IDENTIFIER` | `etendo-skin-topbar.js:323` | The record crumb in the title. |
| `OB.Utilities.openDirectView` | `etendo-skin-grid.js:458` | Reference cells as links. |
| `isc.OBStandardView.STATE_TOP_MAX`, `view.setHalfSplit` | `etendo-skin-form.js:370, 382` | Splitting the window when the lines open. |
| `isc.OBMessageBar.TYPE_WARNING` | `etendo-skin-form.js:1152` | The hidden required fields notice. |
| `isc.isA.OBStandardWindow`, `isc.isA.SectionItem`, `HiddenItem`, `ButtonItem`, `Tree` | form, grid | Deciding what a view, item or data set is. |
| `isc.Page.setEvent('resize')`, `isc.Page.getWidth` | `etendo-skin-topbar.js:770`; toolbar | Refitting the top bar and toolbar. |
| `isc.Menu`, `isc.Canvas`, `isc.HLayout`, `isc.LayoutSpacer`, `isc.OBToolbarIconButton`, `isc.OBStatusBarTextLabel` | all scripts | Building the skin's own canvases. |

## DOM, events and storage

| What | Where | If it changes |
| --- | --- | --- |
| `document.querySelector('.OBTabBarMain')` + `MutationObserver` on `class` | `etendo-skin-nav.js:723`, `etendo-skin-topbar.js:395` | Selected tab no longer tracked: highlight and title lag. Depends on Core marking the selected tab with a `Selected` class. |
| Capture listeners on `document` (`click`, `input`, `keydown`, `mousedown`) | `etendo-skin-nav.js:1054`, `etendo-skin-form.js:2285` | Only for the skin's own panels and menus (`.etskin-*`). |
| Capture `load` listener on `document` for `iframe[name="OBClassicPopup_iframe"]` and for the unnamed iframe whose parent canvas has an `eventproxy` starting `isc_OBClassicWindow_` (a classic report or window in a tab), and on each of their frames' documents | `etendo-skin-form.js:2363, 2398` | The legacy pages of classic process popups (DocAction, Post, Create from Shipment) and classic reports (Trial Balance, General Ledger, Journal Entries) are no longer restyled: stock 2.50 look. Depends on Core naming the popup iframe `OBClassicPopup_iframe`, on SmartClient's `isc_OBClassicWindow_N` canvas id, on the pages linking `Openbravo_ERP_250.css` and staying same-origin. The listener links `etendo-skin-classic.css` (id `etskin-classic`) and adds `etskin-on` to the frame's `<html>`. |
| Copilot's navigation bar `isc.Button`: `baseStyle === 'navBarButton'` and an `icon` ending in `/AI.png` (`com.etendoerp.copilot`, `copilot_widget_component.js.ftl`) | `etendo-skin-topbar.js:484` | Dressed with `chip(wrapper, 'copilot')`: a round chip that shows `web/images/copilot-toolbar.png`, with its word in the tooltip. | The dark "Copilot" text pill comes back. |
| `wheel` listener on `document` (not passive) for targets inside `.OBTabBarMain` / `.OBTabBarChild` | `etendo-skin.js:424` | With the stock scroller off, a strip wider than its box no longer scrolls with the wheel or the trackpad; selecting a tab still scrolls it into view. Depends on Core's tab bar class names and on SmartClient keeping the strip's `overflow: hidden` element as the scrolling box. |
| `localStorage`: `etskin.fields.v1.*`, `etskin.columns.v1.*`, `etskin.nav.collapsed` | form, nav | Choices per user, role and tab; lost when storage is cleared (ETP-5940). |

## CSS: SmartClient class names matched

`etendo-skin.css` styles stock elements by their SmartClient class names, all under `.etskin-on`.
These are the names an upgrade must keep, or the rule silently stops applying (the element falls back
to the stock look; nothing breaks functionally).

- **288 attribute selectors** (`[class^="…"]`, `[class*="…"]`), used because SmartClient appends
  state suffixes to a base name. Families: `OBFormField*` (87), `OBTabBar*` (27), `OBMessageBar*` (15),
  `OBToolbarIcon*` (12), `OBGridCell*` (12), `OBGridHeader*` (9), `OBSectionItem*` (7),
  `OBFormButton*` (6), `OBToolbarText*`, `OBNavBar*` (5 each), and smaller ones (`OBApplicationMenu*`,
  `OBStatusBar*`, `OBGridLink*`, `OBGridFilter*`, `OBPopup*`, `OBDialog*`, `OBWidgetIcon*`).
- **State suffixes** they depend on: `Selected`, `Over`, `Disabled`, `DisabledOver`, `Focused`,
  `Error`, `Required`, `Down`, `Dark`, `SelectedViewInactive`.
- **Class selectors**: `.OBToolbarIconButton_icon_<name>` (77, one per stock toolbar icon, listed by
  name on purpose), `.OBNavBar*` (34), `.OBGridFilter*` (16), `.OBMyOB*` workspace widgets (13), stock image file names inside `img[src$=…]` and inline `style` (ETP-6449: `statusbar/iconButton-*`, `form/comboBoxPicker`, `date_control`, `search_picker`, `upload_icon`, `erase_icon`, `imageNotAvailable`, `ico-to-new-tab`, `checked`, `unchecked`, `grid/gridHeader_sort*`, `tab/tabBarButtonMain_CloseIcon*`; a renamed file keeps its stock PNG), `.OBWidget*` and `.OBQueryList*` widget cards and their list (ETP-6451),
  `.OBMessageBar*` (12), `.OBViewForm` (9), `.OBQuickLaunch` (7), `.OBApplicationMenu*` (6),
  `.OBToolbar`, `.OBTabBar*`, `.OBStatusBar*`, `.OBLoadingPrompt*` (5 each), and single uses
  (`.OBViewGridBody`, `.OBViewActive`, `.OBViewInActive`, `.OBTabSetMain`, `.OBTopLayout`,
  `.OBPickListBody`, `.OBCenteredBox`, ...).
- **Instance IDs** in the `eventproxy` attribute SmartClient stamps on every canvas's wrapper:
  `OBSectionItemButton` (section heads), `isc_OBNoteCanvasItem`, `isc_OBAttachmentCanvasItem` and
  `isc_OBLinkedItemCanvasItem` (the Notes, Attachments and Linked Items sections: the canvas is named
  after the form item that holds it, as `isc_OBNoteCanvasItem_0_canvas`). A renamed class or a
  SmartClient that stops writing the attribute leaves those sections in the stock look.
- **Process windows** (ETP-5927, ETP-6436): `OBFormButton*`, `OBFormButtonSecondary*` and `OBFormFieldSelectControl*` (the combo's table) inside an `eventproxy`
  starting `isc_processDefinition_` (a parameter window in a tab) or inside `OBPopupBody`;
  `OBFormContainerLayout`, `OBPopupHeader`, `OBPopupHeaderText`.
- **Trees** (ETP-5929): `OBTreeGridCell*` (listed beside `OBGridCell*` in the cell rules), the stock
  image names inside the inline `style` of the tree column's spans (`tree-grid/iconTree_closed`,
  `iconTree_opened`, `iconFolder`, `iconFolder_open`, `iconFolder_into`, `iconFolder_close_into`,
  `iconNode`; the `_into` ones are how Core marks a drop target), and SmartClient's `dragLine` and
  `gridDragTracker`. A renamed image falls back to the stock icon.
- **Classic popups and windows** (ETP-5928, ETP-5918, `etendo-skin-classic.css`, inside their frames only): the 2.50
  page classes `Popup_ContentPane_InfoBar`, `Popup_ContentPane_SeparatorBar`, `Popup_SeparatorBar_bg`,
  `Popup_InfoBar_Icon_cell`, `Popup_InfoBar_text`, `LabelText`, `TitleCell`, `required`, `required_focus`,
  `readonly`, `readonly_focus`, `FieldGroupTitle*`, `FieldGroupContent`, `ButtonLink*` (with the state
  suffixes `_default`, `_hover`, `_active`, `_focus`, `_disabled` the page's script swaps), `Button`,
  `Button_left`, `Button_text`, `Button_right`, `Button_Icon`, the id `buttonOK`, and `MessageBox*`
  (`MessageBoxERROR`, `WARNING`, `SUCCESS`, `INFO`). For the classic reports (ETP-5918) also:
  `Main_ToolBar_bg`, `Main_ToolBar_Button*` (and the imported Default sheet's `border-color ... !important`
  on it), `Main_ToolBar_Button_Icon_Refresh`, `Main_Bottom_bg*`, `Main_ContentPane_Left*`,
  `Main_ContentPane_Right*`, `Main_ContentPane_Client`, `tabBackGround`, `tabBackGroundInit`,
  `tabTabbarBackGround`, `List_width`, `DataGrid_Header_Table`, `DataGrid_Body_Table`,
  `DataGrid_Header_Cell*`, `DataGrid_Body_Row*`, `DataGrid_Body_Cell*`, `LabelLink`, `dojoValidate*` and
  `Combo_focus` (both `!important` in stock).
- **Calendar** (ETP-5929): `OBCalendarGridCell*`, `OBCalendarGridHeaderCell*`, `OBEventWindow`,
  `OBEventWindowHeader`, `OBEventWindowBody`, and, only inside an `eventproxy` containing `Calendar_`,
  SmartClient's `headerBar`, `labelColumn`, `calMonthDayHeader*`, `calMonthDayBody*`,
  `calMonthOtherDay*` and `calMonthEventLink`. The window tab glyphs are scoped to `.OBTabBarMain`
  because the calendar's Day / Week / Month tabs reuse `OBTabBarButtonMain*`.
- **SmartClient's own names**: `menuTitleField`, `menuKeyField`, `menuIconField`, `menuSubmenuField`,
  `menuBody`, `menuButton`, `selectItemPickerIcon`, `tabStyleActive`, `tabStyleActiveSelected`,
  `tabStyleInactive`, `normal`, `pageBackground`, `LoadingPrompt`, `loadingImage`.

To list them again from the source:

```bash
tr -d '\r' < web/com.etendo.modern.skin/css/etendo-skin.css | grep -oE '\[class[\^*$|~]?="[^"]+"\]' | sort | uniq -c | sort -rn
tr -d '\r' < web/com.etendo.modern.skin/css/etendo-skin.css | grep -oE '\.OB[A-Za-z0-9_]+' | sort | uniq -c | sort -rn
```

## Known interactions with other modules

- `com.smf.smartclient.boostedui` overrides `OB.Utilities.createLoadingLayout`. The skin does **not**
  override it: the loading art is styled from CSS only (`etendo-skin.css`, around line 2188; README,
  [The boot screen](../README.md#the-boot-screen)).
- Modules that add toolbar buttons go through `OB.ToolbarRegistry`: they keep their place on the
  strip while there is room and spill into the overflow menu after that (`etendo-skin-toolbar.js`,
  `arrange`).
- Modules that add top bar components after `OB.Layout.initialize` are dressed by the
  `OB.NavBar.addMembers` hook.

## Checking that this list is complete

`node verify/check-source.mjs` (gate **G4 core-contract**, also run by the Source Gate workflow)
finds every wrapped prototype method, replaced global and `addProperties` target in the scripts and
fails when one of them is not named in this file. A new hook therefore lands with its row here. The
same search by hand:

```bash
cd web/com.etendo.modern.skin/js
grep -nE "getPrototype\(\)\.[a-zA-Z]+|= *proto\.[a-zA-Z]+|isc\.[A-Za-z]+\.addProperties|(OB|isc)\.[A-Za-z.]+ *= *function|[a-z]+\.[A-Za-z]+ *= *function \(" *.js
```
