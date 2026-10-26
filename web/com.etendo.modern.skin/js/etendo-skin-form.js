/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

/*
 * Five things about a form that a stylesheet cannot reach, because they are markup or geometry the
 * framework writes rather than paint.
 *
 * The required marker is a bare "*" the form appends inside <b>...</b>, so it is a bold black
 * character with nothing to select and no way to colour. The framework builds it from four string
 * properties, and replacing those with our own is enough: the asterisk arrives already wrapped, and
 * the bold that made every label shout leaves with them.
 *
 * The "open in new tab" arrow is an <img> written by OBViewForm#getTitleHTML with a fixed class.
 * A second class is added to it on the way past so the stylesheet can hide it until the field is
 * under the pointer.
 *
 * A section header is a button whose title is plain text, so there is no element for a stylesheet
 * to turn into a disclosure chevron and the only affordance was a 12px icon at the far left, a
 * hundred pixels from the edge the section actually opens against. A span is appended to the title
 * for the stylesheet to shape and rotate.
 *
 * A new record arrives with its child tabs already open below it - a second grid, empty, because
 * the record it would belong to does not exist yet - taking about half of a form the user is trying
 * to fill in. Core already knows how to collapse them: it is what the maximise button does. It is
 * asked to do it while the record is unsaved and to undo it once the record exists.
 *
 * The status bar names the state of the record ("New", "Editing") but never the record, so the
 * largest text on a screen showing one invoice was the word "New". The record's own identifier is
 * put in front of it, which is also the only heading the form has.
 *
 * ES5 only: this file is concatenated into the kernel bundle and minified by JSMin.
 */
(function () {
  if (typeof isc === 'undefined' || !isc.OBViewForm) {
    return;
  }
  if (typeof OB === 'undefined' || !OB.ETSkin) {
    return;
  }

  var REQUIRED_MARK = ' <span class="etskin-required">*</span>';

  /*
   * The img and the span that wraps the title both carry class OBFormFieldLinkButton. Only the img
   * has a space after the closing quote, because its attributes come from an extraStuff string
   * rather than from literal markup, so that is what identifies it.
   */
  var IMG_CLASS = 'class="OBFormFieldLinkButton" ';
  var IMG_CLASS_SKINNED = 'class="OBFormFieldLinkButton etskin-linkglyph" ';
  var RIGHT_REQUIRED_MARK = '<span class="etskin-required">*</span> ';

  // The stylesheet draws the chevron out of two borders on an empty box, so the span carries no
  // character of its own and nothing to translate.
  var CHEVRON = '<span class="etskin-section-chevron"></span>';

  /*
   * Applied to the instance, not just the prototype. The kernel serialises OBViewForm's own
   * property block into the generated window definition and passes it back as the create config,
   * so a form arrives carrying its own copy of titlePrefix, requiredTitleSuffix and getTitleHTML -
   * own properties, which shadow anything the prototype says. Re-stating them on each new form is
   * what actually reaches the screen; the prototype defaults below still cover forms built any
   * other way. setNewState comes across in the same block and is wrapped here for the same reason.
   */
  function adopt(form) {
    if (!form || form.etskinAdopted) {
      return;
    }
    form.etskinAdopted = true;
    form.titlePrefix = '';
    form.titleSuffix = '';
    form.requiredTitlePrefix = '';
    form.requiredTitleSuffix = REQUIRED_MARK;
    form.requiredRightTitlePrefix = RIGHT_REQUIRED_MARK;
    form.rightTitlePrefix = '';
    form.rightTitleSuffix = '';

    var inner = form.getTitleHTML;
    var newState;
    if (typeof inner === 'function') {
      form.getTitleHTML = function () {
        return markLinkGlyph(inner.apply(this, arguments));
      };
    }

    /*
     * setNewState arrives in that same serialised block, so the form carries its own copy and the
     * patch further down this file - which is on the prototype - is never the one that runs. It is
     * wrapped here instead, and only when the instance really does shadow it, so a form built any
     * other way is left to the prototype and does not get the work done twice.
     */
    if (Object.prototype.hasOwnProperty.call(form, 'setNewState')) {
      newState = form.setNewState;
      if (typeof newState === 'function') {
        form.setNewState = function (isNew) {
          var result = newState.apply(this, arguments);
          try {
            laterSplit(this.view, isNew);
          } catch (e) {
            // A pane that will not move is a pane in its stock place.
          }
          return result;
        };
      }
    }
  }

  function markLinkGlyph(html) {
    if (typeof html !== 'string' || html.indexOf(IMG_CLASS) === -1) {
      return html;
    }
    return html.split(IMG_CLASS).join(IMG_CLASS_SKINNED);
  }

  try {
    var proto = isc.OBViewForm.getPrototype();
    var originalTitleHTML = proto.getTitleHTML;

    isc.OBViewForm.addProperties({
      titlePrefix: '',
      titleSuffix: '',
      requiredTitlePrefix: '',
      requiredTitleSuffix: REQUIRED_MARK,
      requiredRightTitlePrefix: RIGHT_REQUIRED_MARK,
      rightTitlePrefix: '',
      rightTitleSuffix: '',

      getTitleHTML: function () {
        return markLinkGlyph(originalTitleHTML.apply(this, arguments));
      }
    });

    var originalCreate = isc.OBViewForm.create;
    isc.OBViewForm.create = function () {
      var form = originalCreate.apply(this, arguments);
      try {
        adopt(form);
      } catch (e) {
        // A bold asterisk is a blemish, not a broken form.
      }
      return form;
    };
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Etendo Modern Skin could not adjust the form titles', e);
    }
  }

  // ------------------------------------------------------- section chevrons

  /*
   * ImgSectionHeader is a SmartClient class, so it is defined in ISC_Combined.js and is certainly
   * there by the time this file runs. OBSectionItemButton, the subclass a form section actually
   * uses, is defined in the skin's own JavaScript and may not be - which is why the patch goes on
   * the ancestor and identifies the subclass at draw time, when it exists either way.
   *
   * SectionStack headers share the ancestor, so the class name is checked: only a form section gets
   * the chevron.
   */
  function withChevron(header, title) {
    if (typeof title !== 'string' || title.indexOf(CHEVRON) !== -1) {
      return title;
    }
    if (!header.getClassName || header.getClassName().indexOf('OBSectionItemButton') !== 0) {
      return title;
    }
    return title + CHEVRON;
  }

  function decorate(header) {
    var title = header.title;
    var wanted = withChevron(header, title);
    if (wanted !== title && header.setTitle) {
      // setTitle, not an override of getTitle: the background button caches the markup it rendered,
      // so a title that only answers differently when asked never reaches the screen.
      header.setTitle(wanted);
    }
  }

  try {
    if (isc.ImgSectionHeader) {
      var originalHeaderDraw = isc.ImgSectionHeader.getPrototype().draw;
      var originalHeaderTitle = isc.ImgSectionHeader.getPrototype().setTitle;
      isc.ImgSectionHeader.addProperties({
        /*
         * The chevron is added on the way in rather than after the fact, because a section is
         * re-titled while the window is running: the ones that carry a count - Notes, Attachments,
         * Linked Items - are titled again each time their contents are counted, and a title written
         * over ours took the chevron with it. Three of six sections lost theirs that way on a record
         * that had actually been loaded, which a form reached without one did not show.
         *
         * Transforming the argument also means this never calls itself: what it hands to the
         * original already contains the chevron, so the guard in withChevron ends the chain.
         */
        setTitle: function (title) {
          var wanted = title;
          try {
            wanted = withChevron(this, title);
          } catch (e) {
            // A section without a chevron is still a section.
          }
          return originalHeaderTitle.call(this, wanted);
        },

        // The first title arrives as a property rather than through setTitle, so it is put through
        // the same transformation once the header is on screen and knows its own class.
        draw: function () {
          var result = originalHeaderDraw.apply(this, arguments);
          try {
            decorate(this);
          } catch (e) {
            // As above.
          }
          return result;
        }
      });
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Etendo Modern Skin could not adjust the form sections', e);
    }
  }

  // ---------------------------------------------------------- record title

  function escapeHTML(text) {
    return String(text)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;');
  }

  /*
   * What the bar should be called. A saved record has an identifier, which is the string the rest
   * of the application uses for it in grids and in links, so it is the same name the user came
   * here by. A new one has none yet - the fields are empty - so the tab's own title stands in, and
   * the "New" chip beside it says the rest.
   */
  function recordTitle(bar) {
    var view = bar.view;
    var form = view && view.viewForm;
    var values, record;
    if (!view) {
      return '';
    }
    if (form && form.isNew) {
      return view.tabTitle || '';
    }
    values = form && form.getValues ? form.getValues() : null;
    if (values && values._identifier) {
      return String(values._identifier);
    }
    record = view.viewGrid && view.viewGrid.getSelectedRecord
      ? view.viewGrid.getSelectedRecord()
      : null;
    if (record && record._identifier) {
      return String(record._identifier);
    }
    return view.tabTitle || '';
  }

  /*
   * updateContentTitle is the one place the bar rebuilds its contents: it destroys every member and
   * sets a fresh list, so anything added anywhere else is thrown away the next time the record
   * changes. Adding the title after that rebuild is the only placement that survives - and it goes
   * in at index 0 so it reads as the heading it is rather than as another status field.
   *
   * It is called from a second place as well, because the rebuild does not always happen: core
   * labels the bar when a record is new, being edited or just saved, and on a record simply opened
   * from the grid it labels nothing at all - the bar stays empty. So setNewState calls this too,
   * which means it can run twice for one record and has to be able to.
   *
   * Hence etskinTitle. The label is remembered and taken down before another goes up; the destroyed
   * check is for the ordinary case where the bar rebuilt itself in between and already disposed of
   * it. Re-titling is not skipped when the label is still there, because the reason for the second
   * call is usually that the record changed underneath it.
   */
  function titleTheBar(bar) {
    var text = recordTitle(bar);
    var previous = bar.etskinTitle;

    if (previous) {
      bar.etskinTitle = null;
      if (!previous.destroyed) {
        if (bar.content && bar.content.removeMember) {
          bar.content.removeMember(previous);
        }
        previous.destroy();
      }
    }
    if (!text || !bar.content || !bar.content.addMember) {
      return;
    }
    bar.etskinTitle = isc.OBStatusBarTextLabel.create({
      contents: '<span class="etskin-record-title">' + escapeHTML(text) + '</span>'
    });
    bar.content.addMember(bar.etskinTitle, 0);
  }

  try {
    if (isc.OBStatusBar) {
      var originalUpdateTitle = isc.OBStatusBar.getPrototype().updateContentTitle;
      isc.OBStatusBar.addProperties({
        updateContentTitle: function () {
          var result = originalUpdateTitle.apply(this, arguments);
          try {
            titleTheBar(this);
          } catch (e) {
            // An untitled bar is the stock bar, which is what was there before.
          }
          return result;
        }
      });
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Etendo Modern Skin could not title the status bar', e);
    }
  }

  // ------------------------------------------------------------ child panes

  /*
   * The child tabs of an unsaved record can hold nothing - there is no parent row for a line to
   * belong to - so the half of the screen they occupy is half of the screen spent on an empty grid
   * and its empty toolbar, while the form the user is filling in is squeezed above it.
   *
   * setTopMaximum and setHalfSplit are core's own, the two halves of the maximise button, so the
   * collapsed state is a state the window already knows how to be in and the restore button already
   * offers a way out of. Nothing here reimplements a layout.
   *
   * etskinCollapsed records that this file was the one that collapsed the panes, so a record the
   * user had already maximised by hand is not silently re-split when it is saved.
   */
  function collapseChildren(view) {
    if (!view || !view.members || !view.members[1] || !view.setTopMaximum) {
      return;
    }
    if (view.state === isc.OBStandardView.STATE_TOP_MAX) {
      return;
    }
    view.etskinCollapsed = true;
    view.setTopMaximum();
  }

  function restoreChildren(view) {
    if (!view || !view.etskinCollapsed) {
      return;
    }
    view.etskinCollapsed = false;
    if (view.state === isc.OBStandardView.STATE_TOP_MAX && view.setHalfSplit) {
      view.setHalfSplit();
    }
  }

  /*
   * Deferred, because setNewState runs in the middle of building the form: the view is still
   * deciding its own height, and a resize asked for from inside that pass is measured against a
   * layout that has not settled. A tick later the window is whole and the split is arithmetic.
   */
  function laterSplit(view, isNew) {
    setTimeout(function () {
      try {
        if (isNew) {
          collapseChildren(view);
        } else {
          restoreChildren(view);
        }
      } catch (e) {
        // A pane that will not move is a pane in its stock place.
      }
      try {
        // The other half of the record title. A record opened from the grid never reaches
        // updateContentTitle, so without this the heading only appears once the record is touched.
        if (view && view.statusBar) {
          titleTheBar(view.statusBar);
        }
      } catch (e) {
        // As above.
      }
    }, 0);
  }

  try {
    var originalNewState = isc.OBViewForm.getPrototype().setNewState;
    isc.OBViewForm.addProperties({
      setNewState: function (isNew) {
        var result = originalNewState.apply(this, arguments);
        try {
          laterSplit(this.view, isNew);
        } catch (e) {
          // As above.
        }
        return result;
      }
    });
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Etendo Modern Skin could not size the child panes', e);
    }
  }
})();

/*
 * GO windows: every standard window of Etendo Classic - every OBStandardWindow, whatever its module -
 * takes the list, form and toolbar language of Etendo GO that the Sales Order pilot proved, with a
 * "Fields" menu in the form and a "Columns" menu in the list. The EMOS views are UIKit canvases, never
 * OBStandardWindow, so nothing here reaches them; every rule of the stylesheet hangs from the class
 * this file puts on a standard window's root, and no SmartClient class is restyled globally.
 *
 * WHICH FIELDS AND COLUMNS. A tab opens on what Core shows it with - its form fields and its grid
 * columns as the dictionary and the role give them - unless this file names a first selection for it,
 * which only the Sales Order header and lines have (approved in the pilot). No other window gets one:
 * which fields and columns matter is chosen from the interface, by the team and the users, not decided
 * here (2026-09-25). Any field or column can then be ticked or unticked, required ones included:
 * the menu offers what this user's form and grid actually carry - Core only emits what the role may
 * see - and, for fields, the ones whose display logic holds for the record that is open.
 *
 * A REQUIRED FIELD THE USER HID. Validation, values and callouts are Etendo's and are left alone, so a
 * required field can be empty and off screen. Core keeps Save disabled while any required field is
 * empty, hidden or not, so the message bar says why, naming each hidden required field that is empty
 * with an action that shows the field and puts the focus in it. A save that still fails on a hidden
 * field - an autosave, a shortcut, an error from the server - gets the same line added to Core's own
 * error message. The reveal lasts until the form is given another record; it never changes the saved
 * choice.
 *
 * HOW A FIELD IS HIDDEN. With the form's own API and the flag Core already uses for exactly this:
 * hiddenInForm, which the form reads to skip a field in its sections, its display logic wrapper
 * and its validation, together with alwaysTakeSpace and the item's hide(). While a field is hidden
 * its show() is held, because a section that expands shows every item it lists. Nothing is removed
 * from the form: the item keeps its value, callouts still write to it and the record still saves
 * it. Display logic and role access are left as they are - an unhidden field appears only where
 * Etendo would show it, and a field Etendo hides stays hidden whatever the menu says.
 *
 * SECTIONS. A whole section - a field group, or the notes, linked items, attachments and audit
 * blocks Core adds - is hidden or shown from its own row in the same menu, and kept by its name: the
 * field group's id or Core's fixed name, never its translated title. Its header goes the way Core
 * hides those blocks, and its fields go with it without losing their own ticks. A field in error or
 * missing inside a hidden section gets the same action as any hidden field, which brings the section
 * back for that record only.
 *
 * THE MENU stays open through every tick, with its search and its scroll, until a click outside it,
 * Escape, its close button or the toolbar button that opened it.
 *
 * THE FRAME. While a standard window is on screen the lavender desk and window strip around it take
 * the grey of the approved bars and the window is one white sheet.
 *
 * WHERE THE CHOICE LIVES. In localStorage, keyed by user, role and tab, so it survives closing and
 * reopening the window in this browser. It does not follow the user to another browser or device:
 * that needs the server-side store, which is the next step, not this one. The native form
 * personalization is deliberately not used - this installation's licence makes Core skip it - and
 * its button, which here only answers with the licence notice, gives way to the Fields menu.
 *
 * THE LIST. Each grid of the window is given GO's proportions - 44px rows under a 40px header - and
 * its filter row is folded away behind a Filters button that brings it back; the criteria themselves
 * are never touched, so a filter that is on stays on and the button counts it. The same button that
 * offers the form's fields offers the grid's columns while the list is showing, kept per user, role
 * and tab like the fields. A window with child tabs gives the main list the larger share of the
 * split; the child tabs stay one resize bar away. The toolbar leads with Filters, New is GO's filled
 * primary in the list and Save is in the form, each with its word.
 *
 * The strings are this file's own, in Spanish, as agreed; they become AD messages when the design
 * leaves the rehearsal.
 */
(function () {
  if (typeof isc === 'undefined' || !isc.OBViewForm || !isc.OBStandardWindow) {
    return;
  }
  if (typeof OB === 'undefined' || !OB.ETSkin || !OB.ToolbarRegistry) {
    return;
  }

  /*
   * First selections, by AD_Tab id: the fields a form opens on and the columns a grid opens on. Only
   * Sales Order's, approved in its pilot, are kept here; every other tab opens exactly as Core shows it
   * and its visibility is configured from the Fields and Columns menus. The user's saved choices
   * always win over these lists, and Reset returns to them.
   */
  var DEFAULTS = {
    '186': [
      'organization', 'transactionDocument', 'documentNo', 'orderDate', 'businessPartner',
      'partnerAddress', 'invoiceAddress', 'priceList', 'scheduledDeliveryDate', 'paymentMethod',
      'paymentTerms', 'warehouse'
    ]
  };
  // Every other column the grid offers is one tick away.
  var COLUMN_DEFAULTS = {
    '186': [
      'organization', 'documentNo', 'orderDate', 'businessPartner', 'grandTotalAmount', 'currency',
      'documentStatus', 'deliveryStatus', 'invoiceStatus'
    ],
    // Lines are also typed in the grid. With alternative units managed (the UomManagement
    // preference) the quantity is typed as the operative quantity in its unit and the ordered
    // quantity follows it, read-only, so both stay next to the quantity they drive.
    '187': [
      'lineNo', 'product', 'operativeQuantity', 'operativeUOM', 'orderedQuantity', 'uOM', 'unitPrice',
      'lineNetAmount', 'tax', 'deliveredQuantity'
    ]
  };
  var COLUMN_STORE = 'etskin.columns.v1';
  // GO's table: a 44px row under a 40px header.
  var ROW_HEIGHT = 44;
  var HEADER_HEIGHT = 40;
  // The lines' share of a split window; the main list takes the rest.
  var LINES_SHARE = '38%';
  var FILTERS_TYPE = 'etskinFilters';
  // The toolbar's plain glyph width, and the widths of the two buttons that carry their word.
  var ICON_WIDTH = 32;
  var NEW_WIDTH = 96;
  var SAVE_WIDTH = 104;
  var GO_CLASS = 'etskin-go';
  var BUTTON_TYPE = 'etskinFields';
  var STORE = 'etskin.fields.v1';
  var MENU_WIDTH = 320;
  var TEXT = {
    fields: 'Campos',
    columns: 'Columnas',
    filters: 'Filtros',
    newRecord: 'Nuevo',
    save: 'Guardar',
    search: 'Buscar campo',
    searchColumns: 'Buscar columna',
    close: 'Cerrar',
    inHiddenSection: 'En sección oculta',
    showAll: 'Mostrar todos',
    reset: 'Restablecer',
    required: 'Obligatorio',
    conditional: 'Según el registro',
    forced: 'Visible por un error',
    hiddenErrors: 'Hay campos con error que están ocultos:',
    missingTitle: 'Faltan campos obligatorios que están ocultos',
    reveal: 'Mostrar y enfocar',
    none: 'Ningún campo coincide',
    visible: 'visibles',
    of: 'de',
    unsaved: 'No se pudo guardar en este navegador: la elección vale hasta cerrar la sesión.'
  };

  var menu = null; // the one open menu: { canvas, view }

  // ------------------------------------------------------------------ scope

  // A view of a standard window: its standardWindow is an OBStandardWindow.
  function isGoView(view) {
    return !!(view && view.standardWindow && isGoWindow(view.standardWindow));
  }

  function isGoWindow(pane) {
    return !!(pane && isc.isA.OBStandardWindow && isc.isA.OBStandardWindow(pane));
  }

  /*
   * The window's root carries the class every rule of the design is written under, so nothing
   * reaches anything else - no workspace, no report, no EMOS view, which is never an
   * OBStandardWindow. The class goes on through setStyleName, which SmartClient keeps across
   * redraws. It is added from the two places this file always runs with the window at hand: the
   * form receiving its fields, which happens as the window is built, and the Fields button
   * refreshing its state.
   */
  function ensureMarked(pane) {
    var style;
    if (!isGoWindow(pane)) {
      return;
    }
    style = String(pane.styleName || 'normal');
    if ((' ' + style + ' ').indexOf(' ' + GO_CLASS + ' ') === -1) {
      pane.setStyleName(style + ' ' + GO_CLASS);
    }
    syncMenuWindow();
  }

  /*
   * A menu belongs to the window it opened from; it goes when that window leaves the screen. Checked
   * on every change of the main tab set's selection and from the places this file runs as a window is
   * built - a window that finishes loading replaces its loading pane without selecting anything.
   */
  function syncMenuWindow() {
    var tabSet = OB.MainView && OB.MainView.TabSet;
    var tab;
    if (!menu || !tabSet || !tabSet.getSelectedTab) {
      return;
    }
    tab = tabSet.getSelectedTab();
    if (menu.view.standardWindow !== (tab ? tab.pane : null)) {
      closeMenu();
    }
  }

  // ------------------------------------------------------------ persistence

  function storeKey(view) {
    var user = (OB.User && OB.User.id) || '';
    var role = (OB.User && OB.User.roleId) || '';
    return STORE + '.' + user + '.' + role + '.' + view.tabId;
  }

  /*
   * One entry per user, role and tab holds both kinds of choice, and only what the user changed:
   * choices is {field name: true|false} and the rest of the fields follow the defaults; sections is
   * {section name: false} for each section the user hid. A section's name is its field group's id,
   * or the fixed name Core gives the notes, linked items and attachments blocks - never its title,
   * which changes with the language. An entry written before sections existed simply has none.
   */
  function loadPrefs(view) {
    var raw, parsed, ok;
    if (view.etskinPrefs) {
      return view.etskinPrefs;
    }
    try {
      raw = window.localStorage.getItem(storeKey(view));
      parsed = raw ? JSON.parse(raw) : null;
    } catch (e) {
      parsed = null;
    }
    ok = parsed && parsed.v === 1;
    view.etskinPrefs = {
      choices: ok && parsed.choices ? parsed.choices : {},
      sections: ok && parsed.sections ? parsed.sections : {}
    };
    return view.etskinPrefs;
  }

  function loadChoices(view) {
    return loadPrefs(view).choices;
  }

  function loadSectionChoices(view) {
    return loadPrefs(view).sections;
  }

  function savePrefs(view, choices, sections) {
    view.etskinPrefs = { choices: choices, sections: sections };
    try {
      window.localStorage.setItem(storeKey(view), JSON.stringify({ v: 1, choices: choices, sections: sections }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearChoices(view) {
    view.etskinPrefs = { choices: {}, sections: {} };
    try {
      window.localStorage.removeItem(storeKey(view));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ----------------------------------------------------------------- fields

  function plainText(html) {
    var box = document.createElement('div');
    box.innerHTML = String(html === null || html === undefined ? '' : html);
    return (box.textContent || '').replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ').trim();
  }

  function isSection(item) {
    return !!(isc.isA.SectionItem && isc.isA.SectionItem(item));
  }

  // The sections of the form, by the name of each item they hold.
  function sectionsByItem(form) {
    var map = {};
    var items = form.getItems() || [];
    var i, j, item;
    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (isSection(item) && item.itemIds) {
        for (j = 0; j < item.itemIds.length; j++) {
          map[item.itemIds[j]] = item;
        }
      }
    }
    return map;
  }

  /*
   * A field the menu may offer: a real, displayed input of this form. Out are the sections, the
   * items Core hides for its own reasons (not displayed, status bar only, not personalizable), the
   * hidden inputs and the buttons.
   */
  function isChoosable(item) {
    if (!item || !item.name || isSection(item)) {
      return false;
    }
    if (item.displayed === false || item.statusBarField || item.personalizable === false) {
      return false;
    }
    if (item.hiddenInForm && !item.etskinChooserHidden) {
      return false;
    }
    if ((isc.isA.HiddenItem && isc.isA.HiddenItem(item)) || item.editorType === 'HiddenItem' ||
        item.type === 'hidden') {
      return false;
    }
    if (isc.isA.ButtonItem && isc.isA.ButtonItem(item)) {
      return false;
    }
    // A field of the dictionary always carries its column; the notes, linked items, attachments and
    // audit blocks Core adds to every form do not.
    if (!item.columnName && !item.inpColumnName) {
      return false;
    }
    return true;
  }

  /*
   * Whether Etendo's display logic shows the field for the record that is open, asked exactly the way
   * Core's own sections ask it: through obShowIf, Core's wrapper around the field's logic, which the
   * form keeps even while hide() has emptied the item's showIf. An item with neither has no logic and
   * always applies. The logic reads context the server sends back after each change, so it is only
   * trustworthy once that answer has been processed - see processFICReturn below. The wrapper also
   * answers false for a hidden field, which is the menu's business and not the record's, so it is
   * asked on a stand-in that carries everything it reads except that flag. A logic that cannot be
   * evaluated counts as applicable: the field stays in the menu and Etendo still decides.
   */
  function appliesToRecord(item) {
    var form = item.form;
    var logic = isc.isA.Function(item.obShowIf) ? item.obShowIf : item.showIf;
    var probe;
    if (!form || !isc.isA.Function(logic)) {
      return true;
    }
    probe = {
      originalShowIf: item.originalShowIf,
      statusBarField: item.statusBarField,
      hiddenInForm: false,
      form: form,
      name: item.name
    };
    try {
      return !!logic.call(probe, probe, item.getValue(), form, form.getValues());
    } catch (e) {
      return true;
    }
  }

  // The menu's list: what the form carries for this user, minus what does not apply to this record.
  function offeredFields(form) {
    var fields = choosableFields(form);
    var out = [];
    var i;
    for (i = 0; i < fields.length; i++) {
      if (appliesToRecord(fields[i])) {
        out.push(fields[i]);
      }
    }
    return out;
  }

  function choosableFields(form) {
    var items = form.getItems() || [];
    var out = [];
    var i;
    for (i = 0; i < items.length; i++) {
      if (isChoosable(items[i])) {
        out.push(items[i]);
      }
    }
    return out;
  }

  function wantsVisible(view, item, choices) {
    var defaults = DEFAULTS[view.tabId];
    if (!choices) {
      choices = loadChoices(view);
    }
    if (Object.prototype.hasOwnProperty.call(choices, item.name)) {
      return !!choices[item.name];
    }
    return !defaults || defaults.indexOf(item.name) !== -1;
  }

  // The item's own show() while the menu keeps it hidden: a section that expands shows every item it
  // lists, and a hidden field must not come back that way.
  function heldShow() {
    return this;
  }

  function heldShowIf() {
    return false;
  }

  function formSections(form) {
    var items = form.getItems() || [];
    var out = [];
    var i;
    for (i = 0; i < items.length; i++) {
      if (isSection(items[i]) && items[i].name) {
        out.push(items[i]);
      }
    }
    return out;
  }

  function sectionWanted(view, section, sections) {
    if (!sections) {
      sections = loadSectionChoices(view);
    }
    return !(Object.prototype.hasOwnProperty.call(sections, section.name) && sections[section.name] === false);
  }

  // Hidden by the menu for this record: unticked, and not revealed for an error.
  function sectionOff(view, section, sections) {
    return !!section && !section.etskinForced && !sectionWanted(view, section, sections);
  }

  /*
   * A section goes the way Core itself hides the notes, linked items and attachments blocks - the
   * header is hidden - except that Core's own flag, hiddenInForm, is left for Core: it is how Core
   * says whether it wants the block for the record in hand, and it keeps saying so while the menu
   * has the block hidden. While hidden the section answers no to Core's show() and to its showIf, so
   * a new record, a collapse or a field coming back cannot bring it back. Shown again, it gets back
   * the showIf it had, and appears only if Core wants it for this record.
   */
  function setSectionHidden(section, hide) {
    if (hide) {
      if (section.etskinSectionHidden) {
        return false;
      }
      section.etskinSectionHidden = true;
      section.etskinSavedShowIf = Object.prototype.hasOwnProperty.call(section, 'showIf') ?
        { value: section.showIf } : null;
      section.show = heldShow;
      section.showIf = heldShowIf;
      if (section.hide) {
        section.hide(true);
      }
      return true;
    }
    if (!section.etskinSectionHidden) {
      return false;
    }
    delete section.etskinSectionHidden;
    delete section.show;
    delete section.showIf;
    if (section.etskinSavedShowIf) {
      section.showIf = section.etskinSavedShowIf.value;
    }
    delete section.etskinSavedShowIf;
    if (!section.hiddenInForm && section.show) {
      section.show(true);
    }
    return true;
  }

  /*
   * The members of a hidden section that the menu does not offer as fields - the canvases of the
   * notes, linked items and attachments blocks, and the fields Core keeps hidden - go with it, since a
   * hidden header does not hide what is under it. Shown again only where Core would show them: in an
   * expanded section and not hidden by Core.
   */
  function holdMember(form, item, hold, section) {
    if (hold) {
      if (item.etskinSectionHeld) {
        return false;
      }
      if (form.getFocusItem && form.getFocusItem() === item && item.blurItem) {
        item.blurItem();
      }
      item.etskinSectionHeld = true;
      item.etskinHeldTakeSpace = item.alwaysTakeSpace;
      item.alwaysTakeSpace = false;
      if (!item.etskinOwnShow) {
        item.etskinOwnShow = true;
        item.show = heldShow;
      }
      if (item.hide) {
        item.hide(true);
      }
      return true;
    }
    if (!item.etskinSectionHeld) {
      return false;
    }
    delete item.etskinSectionHeld;
    item.alwaysTakeSpace = item.etskinHeldTakeSpace;
    delete item.etskinHeldTakeSpace;
    if (item.etskinOwnShow) {
      delete item.show;
      delete item.etskinOwnShow;
    }
    if (section.isExpanded && section.isExpanded() && !item.hiddenInForm && item.displayed !== false &&
        item.show && appliesToRecord(item)) {
      item.show(true);
    }
    return true;
  }

  function setHidden(form, item, hide, sections) {
    var section;
    if (hide) {
      // A field that goes away while it holds the focus takes its input out of the page mid-blur,
      // which SmartClient does not survive; the focus leaves it first.
      if (form.getFocusItem && form.getFocusItem() === item && item.blurItem) {
        item.blurItem();
      }
      item.etskinChooserHidden = true;
      item.hiddenInForm = true;
      item.alwaysTakeSpace = false;
      if (!item.etskinOwnShow) {
        item.etskinOwnShow = true;
        item.show = heldShow;
      }
      if (item.hide) {
        item.hide();
      }
      return;
    }
    delete item.etskinChooserHidden;
    delete item.hiddenInForm;
    if (item.etskinOwnShow) {
      delete item.show;
      delete item.etskinOwnShow;
    }
    section = sections[item.name];
    item.alwaysTakeSpace = !section || (!section.etskinSectionHidden &&
      (section.isExpanded ? section.isExpanded() : true));
    // Shown now, unless its section is collapsed - expanding the section will show it - or Etendo's
    // display logic hides it for this record. A hide() leaves the item invisible until something
    // shows it again, so waiting for the form to re-evaluate the logic is not enough.
    if (item.alwaysTakeSpace && item.show && appliesToRecord(item)) {
      item.show();
    }
  }

  /*
   * Brings the form in line with the choices. Idempotent, and cheap when nothing changes, because it
   * runs every time the form is given its fields and every time it switches between a new and an
   * existing record.
   */
  function applyChoices(form) {
    var view = form && form.view;
    var fields, choices, sections, i, j, item, hide, changed = false, focus;
    var sectionChoices, allSections, section, off, member;
    if (!isGoView(view) || form.isPreviewForm) {
      return;
    }
    ensureMarked(view.standardWindow);
    fields = choosableFields(form);
    choices = loadChoices(view);
    sectionChoices = loadSectionChoices(view);
    sections = sectionsByItem(form);
    focus = form.getFocusItem ? form.getFocusItem() : null;
    // The sections first, so that a field coming back sees whether its section is there.
    allSections = formSections(form);
    for (i = 0; i < allSections.length; i++) {
      section = allSections[i];
      off = sectionOff(view, section, sectionChoices);
      if (off) {
        changed = setSectionHidden(section, true) || changed;
      }
      for (j = 0; section.itemIds && j < section.itemIds.length; j++) {
        member = form.getItem(section.itemIds[j]);
        if (member && !isChoosable(member)) {
          changed = holdMember(form, member, off, section) || changed;
        }
      }
      if (!off) {
        changed = setSectionHidden(section, false) || changed;
      }
    }
    for (i = 0; i < fields.length; i++) {
      item = fields[i];
      item.etskinBySection = sectionOff(view, sections[item.name], sectionChoices);
      hide = (!wantsVisible(view, item, choices) || item.etskinBySection) && !item.etskinForced;
      if (!!item.etskinChooserHidden !== hide) {
        setHidden(form, item, hide, sections);
        changed = true;
      }
    }
    if (changed) {
      form.markForRedraw();
      // Focus never stays on a field that just went away.
      if (focus && focus.etskinChooserHidden && form.focusInNextItem) {
        form.focusInNextItem(focus.name);
      }
    }
  }

  /*
   * Shows one hidden field and puts the focus in it, for this record only: the item is marked forced,
   * which applyChoices respects until setNewState clears it, and the saved choice is not touched. A
   * section the user hid comes back with it the same way, forced and for this record only, and a
   * collapsed section holding the field is expanded, since a field inside a closed section is as
   * invisible as a hidden one.
   */
  function revealField(form, name) {
    var item = form && form.getItem ? form.getItem(name) : null;
    var sections, section, current;
    if (!item) {
      return;
    }
    sections = sectionsByItem(form);
    section = sections[name];
    // The redraw below replaces the inputs; one that still holds the focus must let go first, as a
    // pointer press on the action would have made it.
    current = form.getFocusItem ? form.getFocusItem() : null;
    if (current && current.blurItem) {
      current.blurItem();
    }
    item.etskinForced = true;
    if (section && section.etskinSectionHidden) {
      section.etskinForced = true;
    }
    applyChoices(form);
    if (section && section.isExpanded && !section.isExpanded() && section.expandSection) {
      section.expandSection();
    }
    form.markForRedraw();
    syncMissingNotice(form.view);
    setTimeout(function () {
      try {
        form.focusInItem(name);
      } catch (e) {
        // The field is on screen either way; the focus is a courtesy.
      }
    }, 0);
    refreshMenu('');
  }

  function revealLinks(form, items) {
    var links = [];
    var sections = sectionsByItem(form);
    var i, section;
    for (i = 0; i < items.length; i++) {
      section = items[i].etskinBySection ? sections[items[i].name] : null;
      links.push('<a href="#" class="etskin-reveal" data-form="' + esc(form.ID) + '" data-name="' +
        esc(items[i].name) + '">' + esc(TEXT.reveal) + ' «' + esc(plainText(items[i].title || items[i].name)) +
        '»' + (section ? ' (' + esc(TEXT.inHiddenSection.toLowerCase()) + ' «' +
        esc(plainText(section.title || section.defaultValue || '')) + '»)' : '') + '</a>');
    }
    return links.join(' · ');
  }

  function isEmptyValue(value) {
    return value !== false && value !== 0 && !value;
  }

  // Required, empty, hidden by the menu and applicable to this record: exactly what keeps Save grey.
  function hiddenMissing(form) {
    var fields = choosableFields(form);
    var out = [];
    var i, item;
    for (i = 0; i < fields.length; i++) {
      item = fields[i];
      if (item.etskinChooserHidden && form.isRequired && form.isRequired(item) &&
          !(form.isID && form.isID(item)) && isEmptyValue(item.getValue()) && appliesToRecord(item)) {
        out.push(item);
      }
    }
    return out;
  }

  /*
   * Keeps the message bar honest about the hidden required fields that are empty. It runs on every
   * toolbar refresh, which Core triggers on each change to the form. The notice is a block of its
   * own class: when Core is already showing a message it is appended to it, when not it is shown as a
   * warning, and when nothing is missing any more it is taken out again - hiding the bar only if the
   * bar was showing nothing but the notice.
   */
  function syncMissingNotice(view) {
    var form = view && view.viewForm;
    var bar = view && view.messageBar;
    var missing, block, current, hasOurs, stripped;
    if (!form || !bar || !bar.text || !bar.text.getContents || !isGoView(view)) {
      return;
    }
    missing = view.isShowingForm ? hiddenMissing(form) : [];
    current = String(bar.text.getContents() || '');
    hasOurs = current.indexOf('etskin-missing') !== -1;
    // The bar is ours only while it still shows our block: Core writing its own message ends that.
    if (!hasOurs) {
      bar.etskinOwned = false;
    }
    stripped = current.replace(/<div class="etskin-missing">[\s\S]*?<\/div>/, '');
    if (!missing.length) {
      if (hasOurs) {
        if (bar.etskinOwned) {
          bar.etskinOwned = false;
          bar.hide();
        } else {
          bar.text.setContents(stripped);
        }
      }
      return;
    }
    block = '<div class="etskin-missing">' + revealLinks(form, missing) + '</div>';
    if (bar.isVisible() && !bar.etskinOwned && current && !hasOurs) {
      bar.text.setContents(current + block);
    } else if (bar.isVisible() && hasOurs) {
      if (stripped + block !== current) {
        bar.text.setContents(stripped + block);
      }
    } else {
      bar.setMessage(isc.OBMessageBar.TYPE_WARNING, TEXT.missingTitle, block);
      bar.etskinOwned = true;
    }
  }

  /*
   * Runs after Core has written its own error message, and adds to it rather than replacing it: one
   * line naming every field in error that the user has hidden, each with the action that reveals it.
   * Core passes the errors of a server response; after a failed client validation it passes nothing
   * and the form holds them.
   */
  function noticeHiddenErrors(form, errors) {
    var bar = form.view && form.view.messageBar;
    var all = errors || (form.getErrors ? form.getErrors() : null) || {};
    var hidden = [];
    var name, item, current;
    if (!bar || !bar.text || !isGoView(form.view)) {
      return;
    }
    for (name in all) {
      if (Object.prototype.hasOwnProperty.call(all, name)) {
        item = form.getItem(name);
        if (item && item.etskinChooserHidden) {
          hidden.push(item);
        }
      }
    }
    if (!hidden.length) {
      return;
    }
    bar.etskinOwned = false;
    current = bar.text.getContents ? String(bar.text.getContents() || '') : '';
    bar.text.setContents(current.replace(/<div class="etskin-missing">[\s\S]*?<\/div>/, '') +
      '<div class="etskin-hidden-errors">' + esc(TEXT.hiddenErrors) + ' ' + revealLinks(form, hidden) + '</div>');
  }

  function clearForced(form) {
    var items = form.getItems() || [];
    var i;
    for (i = 0; i < items.length; i++) {
      delete items[i].etskinForced;
    }
  }

  // ------------------------------------------------------------------- grid

  function columnKey(view) {
    var user = (OB.User && OB.User.id) || '';
    var role = (OB.User && OB.User.roleId) || '';
    return COLUMN_STORE + '.' + user + '.' + role + '.' + view.tabId;
  }

  function loadColumnChoices(view) {
    var raw, parsed;
    if (view.etskinColumnChoices) {
      return view.etskinColumnChoices;
    }
    try {
      raw = window.localStorage.getItem(columnKey(view));
      parsed = raw ? JSON.parse(raw) : null;
    } catch (e) {
      parsed = null;
    }
    view.etskinColumnChoices = parsed && parsed.v === 1 && parsed.choices ? parsed.choices : {};
    return view.etskinColumnChoices;
  }

  function saveColumnChoices(view, choices) {
    view.etskinColumnChoices = choices;
    try {
      window.localStorage.setItem(columnKey(view), JSON.stringify({ v: 1, choices: choices }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearColumnChoices(view) {
    view.etskinColumnChoices = {};
    try {
      window.localStorage.removeItem(columnKey(view));
      return true;
    } catch (e) {
      return false;
    }
  }

  // The columns on offer: the grid's own field list, which Core built for this role, without its
  // internal columns - the selection box and the like, whose names start with an underscore.
  function gridColumns(grid) {
    var all = grid && grid.getAllFields ? grid.getAllFields() || [] : [];
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].name && all[i].name.charAt(0) !== '_') {
        out.push(all[i]);
      }
    }
    return out;
  }

  // By name among all of the grid's columns: getField only finds the ones on screen.
  function findColumn(grid, name) {
    var cols = gridColumns(grid);
    var i;
    for (i = 0; i < cols.length; i++) {
      if (cols[i].name === name) {
        return cols[i];
      }
    }
    return null;
  }

  function columnWanted(view, field, choices) {
    var defaults = COLUMN_DEFAULTS[view.tabId];
    var initial = view.viewGrid && view.viewGrid.etskinInitial;
    if (!choices) {
      choices = loadColumnChoices(view);
    }
    if (Object.prototype.hasOwnProperty.call(choices, field.name)) {
      return !!choices[field.name];
    }
    if (defaults) {
      return defaults.indexOf(field.name) !== -1;
    }
    return !!(initial && initial[field.name]);
  }

  /*
   * Folds the filter row away, or brings it back. The row is hidden, never removed: Core reads it to
   * decide whether the grid is filtered - its messages, its implicit filter icon, its Clear filters
   * action all ask for it - so it has to exist for Core to behave as it always has. The grid lays its
   * header and body out again around it.
   */
  function setFolded(grid, folded) {
    var editor = grid && grid.filterEditor;
    grid.etskinFolded = !!folded;
    if (!editor || !editor.isVisible) {
      return;
    }
    if (folded && editor.isVisible()) {
      editor.hide();
    } else if (!folded && !editor.isVisible()) {
      editor.show();
    } else {
      return;
    }
    if (grid.layoutChildren) {
      grid.layoutChildren();
    }
  }

  // Core shows the row again on some redraws; a folded grid folds it back.
  function keepFolded(grid) {
    if (grid && grid.etskinFolded && grid.filterEditor && grid.filterEditor.isVisible &&
        grid.filterEditor.isVisible()) {
      setFolded(grid, true);
    }
  }

  /*
   * Shows and hides columns with the grid's own showField and hideField. While the filter row is on
   * screen SmartClient updates its cells one by one and trips over a column that has just gone, so
   * the row is folded for the change and unfolded after, when it lays itself out for the new columns.
   * It is never removed and created again: that leaves the old row's action button behind on the page.
   */
  function applyColumns(view) {
    var grid = view && view.viewGrid;
    var changes = [];
    var cols, i, want, had;
    if (!grid || !grid.fieldIsVisible) {
      return;
    }
    cols = gridColumns(grid);
    for (i = 0; i < cols.length; i++) {
      want = columnWanted(view, cols[i]);
      if (want !== !!grid.fieldIsVisible(cols[i].name)) {
        changes.push({ name: cols[i].name, show: want });
      }
    }
    if (!changes.length) {
      return;
    }
    had = !grid.etskinFolded;
    if (had) {
      setFolded(grid, true);
    }
    for (i = 0; i < changes.length; i++) {
      if (changes[i].show) {
        grid.showField(changes[i].name);
      } else {
        grid.hideField(changes[i].name);
      }
    }
    if (had) {
      setFolded(grid, false);
    }
  }

  /*
   * Once per grid: GO's row and header heights, the filter row folded away behind the Filters button
   * - hidden, not removed, and the criteria exactly as they are - and the columns the user chose. The columns Core showed
   * are remembered first, as the defaults of a tab this file has no list for.
   */
  function adaptGrid(view) {
    var grid = view && view.viewGrid;
    var cols, i;
    if (!grid || grid.etskinGoGrid || !grid.fieldIsVisible || !grid.isDrawn || !grid.isDrawn()) {
      return;
    }
    grid.etskinGoGrid = true;
    grid.etskinInitial = {};
    cols = gridColumns(grid);
    for (i = 0; i < cols.length; i++) {
      grid.etskinInitial[cols[i].name] = !!grid.fieldIsVisible(cols[i].name);
    }
    if (grid.setCellHeight) {
      grid.setCellHeight(ROW_HEIGHT);
    }
    if (grid.setHeaderHeight) {
      grid.setHeaderHeight(HEADER_HEIGHT);
    }
    setFolded(grid, true);
    applyColumns(view);
  }

  // Every view of the window, the lines included, and the split given to the main list once.
  function adaptWindow(win) {
    var views = win && win.views ? win.views : [];
    var i;
    for (i = 0; i < views.length; i++) {
      adaptGrid(views[i]);
      keepFolded(views[i] && views[i].viewGrid);
    }
    // Once the lines are on screen: a height set before that is overwritten when Core lays them out.
    if (win && win.view && win.view.childTabSet && !win.etskinGoSplit && win.view.childTabSet.isDrawn &&
        win.view.childTabSet.isDrawn() && win.view.childTabSet.isVisible()) {
      win.etskinGoSplit = true;
      win.view.childTabSet.setHeight(LINES_SHARE);
    }
  }

  // The filters in force, counted as the conditions a person set - one per column filtered.
  function filterCount(grid) {
    var count = 0;
    // A child tab's grid is always narrowed to its parent record; that link is not a filter the user
    // set, and Core leaves it out of its own filter handling the same way.
    var parentProperty = grid && grid.view ? grid.view.parentProperty : null;
    function walk(criteria) {
      var list, i;
      if (!criteria) {
        return;
      }
      if (criteria.fieldName) {
        if (String(criteria.fieldName).charAt(0) !== '_' && criteria.fieldName !== parentProperty) {
          count++;
        }
        return;
      }
      list = criteria.criteria || [];
      for (i = 0; i < list.length; i++) {
        walk(list[i]);
      }
    }
    try {
      walk(grid.getCriteria ? grid.getCriteria() : null);
    } catch (e) {
      return 0;
    }
    // The window's own filter - Core's implicit one, shown by its funnel in the filter row - counts too.
    if (grid.filterClause || grid.sqlFilterClause) {
      count++;
    }
    return count;
  }

  function toolbarMember(view, type) {
    var members = view && view.toolBar && view.toolBar.getMembers ? view.toolBar.getMembers() : [];
    var i;
    for (i = 0; i < members.length; i++) {
      if (members[i].buttonType === type) {
        return members[i];
      }
    }
    return null;
  }

  function refreshFiltersButton(view) {
    var button = toolbarMember(view, FILTERS_TYPE);
    if (button && button.updateState) {
      button.updateState();
    }
  }

  /*
   * Gives a toolbar button its word, or takes it back. The skin's toolbar arrangement re-asserts each
   * button's width and classes from its mark on every refresh, so the mark is what changes; the
   * class is also taken off the element directly, since the arrangement only ever adds classes.
   */
  function labelButton(button, width, cls, on) {
    var mark = button && button.etskinMark;
    var handle = button && button.getHandle ? button.getHandle() : null;
    var list, at;
    if (!mark) {
      return;
    }
    list = mark.classes ? mark.classes.split(' ') : [];
    at = list.indexOf(cls);
    if (on && at === -1) {
      list.push(cls);
    } else if (!on && at !== -1) {
      list.splice(at, 1);
    }
    mark.classes = list.join(' ');
    mark.width = on ? width : ICON_WIDTH;
    if (button.getWidth && button.getWidth() !== mark.width) {
      button.setWidth(mark.width);
    }
    if (handle) {
      if (on) {
        handle.classList.add(cls);
      } else {
        handle.classList.remove(cls);
      }
    }
  }

  // New is the list's primary action and Save the form's, as GO has them.
  function labelToolbar(view) {
    labelButton(toolbarMember(view, 'newDoc'), NEW_WIDTH, 'etskin-tb-new', !view.isShowingForm);
    labelButton(toolbarMember(view, 'save'), SAVE_WIDTH, 'etskin-tb-savelabel', !!view.isShowingForm);
  }

  // ------------------------------------------------------------------- menu

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;');
  }

  function countText(form) {
    var fields = offeredFields(form);
    var sections = sectionsByItem(form);
    var shown = 0;
    var i;
    for (i = 0; i < fields.length; i++) {
      if (wantsVisible(form.view, fields[i]) && !sectionOff(form.view, sections[fields[i].name])) {
        shown++;
      }
    }
    return shown + ' ' + TEXT.of + ' ' + fields.length + ' ' + TEXT.visible;
  }

  // The tick is the user's choice, not the field's current state: a field revealed for an error
  // is on screen but still unticked, and says so; a ticked field of a hidden section says why it is
  // not on screen.
  function fieldTag(item, on) {
    if (item.etskinForced && !on) {
      return TEXT.forced;
    }
    if (item.etskinBySection && on) {
      return TEXT.inHiddenSection;
    }
    if (item.required) {
      return TEXT.required;
    }
    if (isc.isA.Function(item.obShowIf) || isc.isA.Function(item.showIf)) {
      return TEXT.conditional;
    }
    return '';
  }

  function sectionTag(view, section) {
    return section.etskinForced && !sectionWanted(view, section) ? TEXT.forced : '';
  }

  function rowHTML(item, section) {
    var on = wantsVisible(item.form.view, item);
    var title = plainText(item.title || item.name);
    return '<button type="button" class="etskin-fields-row' + (section ? ' etskin-fields-child' : '') +
      '" role="menuitemcheckbox" aria-checked="' + (on ? 'true' : 'false') + '" data-name="' + esc(item.name) +
      '"' + (section ? ' data-parent="' + esc(section.name) + '"' : '') +
      ' data-muted="' + (item.etskinBySection ? 'true' : 'false') + '"' +
      ' data-search="' + esc(title.toLowerCase()) + '">' +
      '<span class="etskin-fields-box"></span>' +
      '<span class="etskin-fields-label">' + esc(title) + '</span>' +
      '<span class="etskin-fields-tag">' + esc(fieldTag(item, on)) + '</span>' +
      '</button>';
  }

  // A section's own row: its tick hides or shows the whole block, fields and all.
  function sectionRowHTML(view, section) {
    var title = plainText(section.title || section.defaultValue || section.name);
    return '<button type="button" class="etskin-fields-row etskin-fields-section" role="menuitemcheckbox"' +
      ' aria-checked="' + (sectionWanted(view, section) ? 'true' : 'false') + '" data-section="' +
      esc(section.name) + '" data-search="' + esc(title.toLowerCase()) + '">' +
      '<span class="etskin-fields-box"></span>' +
      '<span class="etskin-fields-label">' + esc(title) + '</span>' +
      '<span class="etskin-fields-tag">' + esc(sectionTag(view, section)) + '</span>' +
      '</button>';
  }

  /*
   * The sections the menu offers: every one the user hid, so it can always come back, and the ones
   * Core shows for this record - not the blocks Core leaves out of a new record, nor a field group
   * whose every field the display logic hides.
   */
  function offeredSection(view, section, offeredByName) {
    var i, member, choosable = false;
    if (section.etskinSectionHidden || !sectionWanted(view, section)) {
      return true;
    }
    if (section.hiddenInForm) {
      return false;
    }
    for (i = 0; section.itemIds && i < section.itemIds.length; i++) {
      if (offeredByName[section.itemIds[i]]) {
        return true;
      }
      member = section.form.getItem(section.itemIds[i]);
      if (member && isChoosable(member)) {
        choosable = true;
      }
    }
    return !choosable;
  }

  function menuHTML(view) {
    var form = view.viewForm;
    var fields = offeredFields(form);
    var sections = sectionsByItem(form);
    var items = form.getItems() || [];
    var offeredByName = {};
    var html = [];
    var i, item;
    for (i = 0; i < fields.length; i++) {
      offeredByName[fields[i].name] = true;
    }

    html.push('<div class="etskin-fields" role="dialog" aria-label="' + esc(TEXT.fields) + '">');
    html.push(headHTML(TEXT.fields, countText(form)));
    html.push('<div class="etskin-fields-search"><span class="etskin-fields-search-icon"></span>' +
      '<input type="text" class="etskin-fields-input" autocomplete="off" spellcheck="false" placeholder="' +
      esc(TEXT.search) + '" aria-label="' + esc(TEXT.search) + '"></div>');
    html.push('<div class="etskin-fields-list">');
    // In the form's order: the fields outside any section, then each section and its fields.
    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (isSection(item) && item.name) {
        if (offeredSection(view, item, offeredByName)) {
          html.push(sectionRowHTML(view, item));
        }
      } else if (offeredByName[item.name]) {
        html.push(rowHTML(item, sections[item.name] || null));
      }
    }
    html.push('</div>');
    html.push('<div class="etskin-fields-empty">' + esc(TEXT.none) + '</div>');
    html.push('<div class="etskin-fields-foot"><button type="button" class="etskin-fields-all">' +
      esc(TEXT.showAll) + '</button><button type="button" class="etskin-fields-reset">' +
      esc(TEXT.reset) + '</button></div>');
    html.push('<div class="etskin-fields-note"></div>');
    html.push('</div>');
    return html.join('');
  }

  // The title, the count and the button that closes the menu - which otherwise stays open through
  // every tick, until a click outside it or Escape.
  function headHTML(title, count) {
    return '<div class="etskin-fields-head"><span class="etskin-fields-title">' + esc(title) +
      '</span><span class="etskin-fields-count">' + esc(count) + '</span>' +
      '<button type="button" class="etskin-fields-close" aria-label="' + esc(TEXT.close) + '" title="' +
      esc(TEXT.close) + '"></button></div>';
  }

  function columnCountText(view) {
    var cols = gridColumns(view.viewGrid);
    var shown = 0;
    var i;
    for (i = 0; i < cols.length; i++) {
      if (columnWanted(view, cols[i])) {
        shown++;
      }
    }
    return shown + ' ' + TEXT.of + ' ' + cols.length + ' ' + TEXT.visible;
  }

  function columnsMenuHTML(view) {
    var cols = gridColumns(view.viewGrid);
    var html = [];
    var i, title;
    html.push('<div class="etskin-fields" role="dialog" aria-label="' + esc(TEXT.columns) + '">');
    html.push(headHTML(TEXT.columns, columnCountText(view)));
    html.push('<div class="etskin-fields-search"><span class="etskin-fields-search-icon"></span>' +
      '<input type="text" class="etskin-fields-input" autocomplete="off" spellcheck="false" placeholder="' +
      esc(TEXT.searchColumns) + '" aria-label="' + esc(TEXT.searchColumns) + '"></div>');
    html.push('<div class="etskin-fields-list">');
    for (i = 0; i < cols.length; i++) {
      title = plainText(cols[i].title || cols[i].name);
      html.push('<button type="button" class="etskin-fields-row" role="menuitemcheckbox" aria-checked="' +
        (columnWanted(view, cols[i]) ? 'true' : 'false') + '" data-name="' + esc(cols[i].name) + '"' +
        ' data-search="' + esc(title.toLowerCase()) + '">' +
        '<span class="etskin-fields-box"></span>' +
        '<span class="etskin-fields-label">' + esc(title) + '</span></button>');
    }
    html.push('</div>');
    html.push('<div class="etskin-fields-empty">' + esc(TEXT.none) + '</div>');
    html.push('<div class="etskin-fields-foot"><button type="button" class="etskin-fields-all">' +
      esc(TEXT.showAll) + '</button><button type="button" class="etskin-fields-reset">' +
      esc(TEXT.reset) + '</button></div>');
    html.push('<div class="etskin-fields-note"></div>');
    html.push('</div>');
    return html.join('');
  }

  function menuRoot() {
    return document.querySelector('.etskin-fields');
  }

  function refreshMenu(noteText) {
    var root = menuRoot();
    var form, rows, i, item, note, name, on, tag, tagEl;
    if (!root || !menu) {
      return;
    }
    rows = root.querySelectorAll('.etskin-fields-row');
    if (menu.mode === 'columns') {
      for (i = 0; i < rows.length; i++) {
        item = findColumn(menu.view.viewGrid, rows[i].getAttribute('data-name'));
        rows[i].setAttribute('aria-checked', item && columnWanted(menu.view, item) ? 'true' : 'false');
      }
      root.querySelector('.etskin-fields-count').textContent = columnCountText(menu.view);
    } else {
      // Only the ticks, tags and counts change: the list, the search and the scroll stay as they are.
      form = menu.view.viewForm;
      for (i = 0; i < rows.length; i++) {
        name = rows[i].getAttribute('data-section');
        if (name) {
          item = form.getItem(name);
          on = !!item && sectionWanted(menu.view, item);
          tag = item ? sectionTag(menu.view, item) : '';
        } else {
          item = form.getItem(rows[i].getAttribute('data-name'));
          on = !!item && wantsVisible(menu.view, item);
          tag = item ? fieldTag(item, on) : '';
          rows[i].setAttribute('data-muted', item && item.etskinBySection ? 'true' : 'false');
        }
        rows[i].setAttribute('aria-checked', on ? 'true' : 'false');
        tagEl = rows[i].querySelector('.etskin-fields-tag');
        if (tagEl && tagEl.textContent !== tag) {
          tagEl.textContent = tag;
        }
      }
      root.querySelector('.etskin-fields-count').textContent = countText(form);
    }
    note = root.querySelector('.etskin-fields-note');
    note.textContent = noteText || '';
    note.style.display = noteText ? 'block' : 'none';
  }

  /*
   * A row stays while its text matches. A section's row also stays while one of its fields does,
   * and a section whose own name matches keeps all of its fields.
   */
  function filterMenu(query) {
    var root = menuRoot();
    var q = String(query || '').toLowerCase().trim();
    var rows, i, el, name, parent, shown = 0, own = {}, kept = {};
    if (!root) {
      return;
    }
    rows = root.querySelectorAll('.etskin-fields-row');
    for (i = 0; i < rows.length; i++) {
      name = rows[i].getAttribute('data-section');
      if (name) {
        own[name] = !q || rows[i].getAttribute('data-search').indexOf(q) !== -1;
      }
    }
    for (i = 0; i < rows.length; i++) {
      el = rows[i];
      if (el.getAttribute('data-section')) {
        continue;
      }
      parent = el.getAttribute('data-parent');
      el.style.display = !q || el.getAttribute('data-search').indexOf(q) !== -1 || (parent && own[parent]) ?
        '' : 'none';
      if (el.style.display === '') {
        shown++;
        if (parent) {
          kept[parent] = true;
        }
      }
    }
    for (i = 0; i < rows.length; i++) {
      name = rows[i].getAttribute('data-section');
      if (name) {
        rows[i].style.display = own[name] || kept[name] ? '' : 'none';
        if (rows[i].style.display === '') {
          shown++;
        }
      }
    }
    root.querySelector('.etskin-fields-empty').style.display = shown ? 'none' : 'block';
  }

  function commit(view, choices, sections) {
    var saved = savePrefs(view, choices, sections || loadSectionChoices(view));
    applyChoices(view.viewForm);
    syncMissingNotice(view);
    refreshMenu(saved ? '' : TEXT.unsaved);
  }

  function toggleColumn(name) {
    var view = menu.view;
    var field = findColumn(view.viewGrid, name);
    var choices, saved;
    if (!field) {
      return;
    }
    choices = isc.addProperties({}, loadColumnChoices(view));
    choices[name] = !columnWanted(view, field, choices);
    saved = saveColumnChoices(view, choices);
    applyColumns(view);
    refreshMenu(saved ? '' : TEXT.unsaved);
  }

  function toggleSection(name) {
    var view = menu.view;
    var section = view.viewForm.getItem(name);
    var sections;
    if (!section) {
      return;
    }
    sections = isc.addProperties({}, loadSectionChoices(view));
    if (sectionWanted(view, section, sections)) {
      sections[name] = false;
    } else {
      delete sections[name];
    }
    delete section.etskinForced;
    commit(view, loadChoices(view), sections);
  }

  function toggle(name) {
    var view = menu.view;
    var item = view.viewForm.getItem(name);
    var choices;
    if (menu.mode === 'columns') {
      toggleColumn(name);
      return;
    }
    if (!item) {
      return;
    }
    choices = isc.addProperties({}, loadChoices(view));
    choices[name] = !wantsVisible(view, item, choices);
    delete item.etskinForced;
    commit(view, choices);
  }

  function showAll() {
    var view = menu.view;
    var fields, choices, i, cols, saved;
    if (menu.mode === 'columns') {
      cols = gridColumns(view.viewGrid);
      choices = isc.addProperties({}, loadColumnChoices(view));
      for (i = 0; i < cols.length; i++) {
        choices[cols[i].name] = true;
      }
      saved = saveColumnChoices(view, choices);
      applyColumns(view);
      refreshMenu(saved ? '' : TEXT.unsaved);
      return;
    }
    // Every field and every section.
    fields = offeredFields(view.viewForm);
    choices = isc.addProperties({}, loadChoices(view));
    for (i = 0; i < fields.length; i++) {
      delete fields[i].etskinForced;
      choices[fields[i].name] = true;
    }
    commit(view, choices, {});
  }

  function reset() {
    var view = menu.view;
    var cleared;
    if (menu.mode === 'columns') {
      cleared = clearColumnChoices(view);
      applyColumns(view);
      refreshMenu(cleared ? '' : TEXT.unsaved);
      return;
    }
    cleared = clearChoices(view);
    clearForced(view.viewForm);
    applyChoices(view.viewForm);
    syncMissingNotice(view);
    refreshMenu(cleared ? '' : TEXT.unsaved);
  }

  function closeMenu() {
    if (!menu) {
      return;
    }
    menu.canvas.destroy();
    if (menu.button && menu.button.etskinPressed) {
      menu.button.etskinPressed(false);
    }
    menu = null;
  }

  function openMenu(button) {
    var view = button.view;
    var left, top, input, mode;
    if (menu) {
      closeMenu();
      return;
    }
    if (!isGoView(view)) {
      return;
    }
    mode = view.isShowingForm ? 'fields' : 'columns';
    if (mode === 'fields') {
      applyChoices(view.viewForm);
    } else if (!view.viewGrid) {
      return;
    }
    left = button.getPageLeft() + button.getVisibleWidth() - MENU_WIDTH;
    top = button.getPageTop() + button.getVisibleHeight() + 6;
    menu = {
      view: view,
      button: button,
      mode: mode,
      canvas: isc.Canvas.create({
        autoDraw: false,
        left: Math.max(8, left),
        top: top,
        width: MENU_WIDTH,
        height: 1,
        overflow: 'visible',
        canFocus: false,
        redrawOnResize: false,
        styleName: 'etskinFieldsCanvas',
        contents: mode === 'columns' ? columnsMenuHTML(view) : menuHTML(view)
      })
    };
    menu.canvas.draw();
    menu.canvas.bringToFront();
    refreshMenu('');
    input = menuRoot() && menuRoot().querySelector('.etskin-fields-input');
    if (input) {
      input.focus();
    }
  }

  // Delegated on the document, in the capture phase, for the same reasons as the side navigation:
  // SmartClient stops much of what happens inside its canvases, and a redraw drops listeners.
  function onClick(event) {
    var target = event.target || event.srcElement;
    var root = menuRoot();
    var row, reveal;
    reveal = target && target.closest ? target.closest('.etskin-reveal') : null;
    if (reveal) {
      event.preventDefault();
      revealField(window[reveal.getAttribute('data-form')], reveal.getAttribute('data-name'));
      return;
    }
    if (!root || !menu || !root.contains(target)) {
      return;
    }
    if (target.closest('.etskin-fields-close')) {
      closeMenu();
      return;
    }
    if (target.closest('.etskin-fields-all')) {
      showAll();
      return;
    }
    if (target.closest('.etskin-fields-reset')) {
      reset();
      return;
    }
    row = target.closest('.etskin-fields-row');
    if (row && row.getAttribute('data-section')) {
      toggleSection(row.getAttribute('data-section'));
    } else if (row) {
      toggle(row.getAttribute('data-name'));
    }
  }

  function onInput(event) {
    var target = event.target || event.srcElement;
    if (target && target.className === 'etskin-fields-input') {
      filterMenu(target.value);
    }
  }

  function onKeyDown(event) {
    if (menu && (event.key === 'Escape' || event.keyCode === 27)) {
      closeMenu();
      event.stopPropagation();
    }
  }

  /*
   * The menu closes on a press outside it, and on nothing else but Escape and its own close button.
   * It is watched here rather than with a SmartClient click mask: a soft mask also gives way when the
   * focus moves into what it covers, which is what the form and the grid do as they redraw after a
   * tick. A press inside the menu stops here, so SmartClient neither takes the focus away from the
   * search nor sees a press on what lies under the menu; on a row or a button it also keeps the focus
   * where it was, so the search can go on being typed into. A press on the menu's own button is left
   * to the button, which closes the menu.
   */
  function onMouseDown(event) {
    var target = event.target || event.srcElement;
    var root = menuRoot();
    var handle;
    if (!menu || !root || !target) {
      return;
    }
    if (root.contains(target)) {
      event.stopPropagation();
      if (target.className !== 'etskin-fields-input' && target.closest && target.closest('button')) {
        event.preventDefault();
      }
      return;
    }
    handle = menu.button && menu.button.getHandle ? menu.button.getHandle() : null;
    if (handle && handle.contains(target)) {
      return;
    }
    closeMenu();
  }

  // ---------------------------------------------------------------- toolbar

  /*
   * The native personalization button of a standard window, which in this installation only answers
   * with the licence notice; the Fields menu takes its place. It is hidden from the Fields button,
   * which only exists on standard windows, so nothing else is touched.
   */
  function hideNativePersonalization(button) {
    var toolbar = button.view && button.view.toolBar;
    var members = toolbar && toolbar.getMembers ? toolbar.getMembers() : [];
    var i;
    for (i = 0; i < members.length; i++) {
      if (members[i].buttonType === 'personalization' && members[i].isVisible && members[i].isVisible()) {
        members[i].hide();
      }
    }
  }

  function registerButton() {
    OB.ToolbarRegistry.registerButton(BUTTON_TYPE, isc.OBToolbarIconButton, {
      buttonType: BUTTON_TYPE,
      prompt: TEXT.fields,
      // Refreshed by the skin's toolbar arrangement, which otherwise leaves the view buttons alone.
      etskinStateful: true,
      action: function () {
        openMenu(this);
      },
      etskinPressed: function (on) {
        var handle = this.getHandle && this.getHandle();
        if (handle) {
          handle.setAttribute('aria-expanded', on ? 'true' : 'false');
        }
      },
      // Fields while the form is showing, Columns while the list is; the stylesheet swaps the word.
      updateState: function () {
        var view = this.view;
        var handle = this.getHandle && this.getHandle();
        var mode;
        if (!isGoView(view)) {
          this.hide();
          return;
        }
        ensureMarked(view.standardWindow);
        syncMenuWindow();
        hideNativePersonalization(this);
        adaptWindow(view.standardWindow);
        labelToolbar(view);
        syncMissingNotice(view);
        mode = view.isShowingForm ? 'fields' : 'columns';
        if (menu && menu.button === this && menu.mode !== mode) {
          closeMenu();
        }
        if (handle) {
          handle.setAttribute('data-mode', mode);
        }
        this.setPrompt(mode === 'columns' ? TEXT.columns : TEXT.fields);
        this.show();
      }
    }, 360);
  }

  /*
   * Filters: the filter row, folded away by adaptGrid, comes back and goes again from here. Only the
   * row is shown or hidden - the criteria are the grid's and stay as they are - and the button says
   * how many are in force, so a list that is filtered never looks as if it were not.
   */
  function registerFiltersButton() {
    OB.ToolbarRegistry.registerButton(FILTERS_TYPE, isc.OBToolbarIconButton, {
      buttonType: FILTERS_TYPE,
      prompt: TEXT.filters,
      action: function () {
        var grid = this.view && this.view.viewGrid;
        if (!grid || !grid.filterEditor) {
          return;
        }
        setFolded(grid, !grid.etskinFolded);
        this.updateState();
      },
      updateState: function () {
        var view = this.view;
        var grid = view && view.viewGrid;
        var handle = this.getHandle && this.getHandle();
        var count;
        if (!isGoView(view) || view.isShowingForm || !grid) {
          this.hide();
          return;
        }
        adaptWindow(view.standardWindow);
        count = filterCount(grid);
        if (handle) {
          handle.setAttribute('data-badge', count ? ' · ' + count : '');
          handle.setAttribute('aria-pressed', grid.etskinFolded ? 'false' : 'true');
        }
        this.show();
      }
    }, 1);
  }

  // ------------------------------------------------------------------ hooks

  try {
    document.documentElement.style.setProperty('--sk-fields-label', JSON.stringify(TEXT.fields));
    document.documentElement.style.setProperty('--sk-columns-label', JSON.stringify(TEXT.columns));
    document.documentElement.style.setProperty('--sk-filters-label', JSON.stringify(TEXT.filters));
    document.documentElement.style.setProperty('--sk-new-label', JSON.stringify(TEXT.newRecord));
    document.documentElement.style.setProperty('--sk-save-label', JSON.stringify(TEXT.save));
    registerButton();
    registerFiltersButton();

    var originalSetFields = isc.OBViewForm.getPrototype().setFields;
    var originalGoNewState = isc.OBViewForm.getPrototype().setNewState;
    var originalEditRecord = isc.OBViewForm.getPrototype().editRecord;
    var originalEditNewRecord = isc.OBViewForm.getPrototype().editNewRecord;
    var originalShowErrors = isc.OBViewForm.getPrototype().showErrors;
    isc.OBViewForm.addProperties({
      setFields: function () {
        var result = originalSetFields.apply(this, arguments);
        try {
          applyChoices(this);
        } catch (e) {
          // A form that cannot be narrowed still works: it simply shows every field.
        }
        return result;
      },
      setNewState: function () {
        var result = originalGoNewState.apply(this, arguments);
        try {
          clearForced(this);
          applyChoices(this);
        } catch (e) {
          // As above.
        }
        return result;
      },
      /*
       * Every record the form is given, new or loaded, starts from the user's choice: a field revealed
       * for an error on the previous record goes back to what the choice says. It is applied before
       * Core loads the record, so that Core puts the focus in a field that stays, and again after.
       */
      editRecord: function () {
        var result;
        try {
          clearForced(this);
          applyChoices(this);
        } catch (e) {
          // As above.
        }
        result = originalEditRecord.apply(this, arguments);
        try {
          applyChoices(this);
        } catch (e) {
          // As above.
        }
        return result;
      },
      editNewRecord: function () {
        var result;
        try {
          clearForced(this);
          applyChoices(this);
        } catch (e) {
          // As above.
        }
        result = originalEditNewRecord.apply(this, arguments);
        try {
          applyChoices(this);
        } catch (e) {
          // As above.
        }
        return result;
      },
      // Showing the errors focuses the first field in error unless told not to, and a field the user
      // hid has no input to focus. Core's showErrors reaches this through its call up the class chain.
      showErrors: function (errors, hiddenErrors, suppressAutoFocus) {
        var first = this.getFirstErrorItem ? this.getFirstErrorItem() : null;
        if (isGoView(this.view) && first && first.etskinChooserHidden) {
          return originalShowErrors.call(this, errors, hiddenErrors, true);
        }
        return originalShowErrors.apply(this, arguments);
      }
    });

    /*
     * handleFieldErrors and setFocusInErrorField are not methods of the OBViewForm class: Core copies
     * them onto every form from OB.ViewFormProperties when the form is created, and neither calls up
     * the class chain, so they are wrapped at that source. Both step aside outside a standard window.
     */
    if (OB.ViewFormProperties) {
      var coreHandleErrors = OB.ViewFormProperties.handleFieldErrors;
      var coreFocusInError = OB.ViewFormProperties.setFocusInErrorField;
      if (coreHandleErrors) {
        // The notice is added even if Core's own handling throws, so the way to the field is never lost.
        OB.ViewFormProperties.handleFieldErrors = function (errors) {
          try {
            return coreHandleErrors.apply(this, arguments);
          } finally {
            try {
              noticeHiddenErrors(this, errors);
            } catch (e) {
              // As above.
            }
          }
        };
      }
      var coreFICReturn = OB.ViewFormProperties.processFICReturn;
      if (coreFICReturn) {
        // The display logic and the values are settled only once the server's answer is in, which is
        // when the notice about hidden required fields can say the right thing.
        OB.ViewFormProperties.processFICReturn = function () {
          var form = this;
          try {
            return coreFICReturn.apply(this, arguments);
          } finally {
            setTimeout(function () {
              try {
                syncMissingNotice(form.view);
                refreshMenu('');
              } catch (e) {
                // As above.
              }
            }, 0);
          }
        };
      }
      if (coreFocusInError) {
        /*
         * Core puts the focus in the first field in error. When the user hid that field there is no
         * input to focus - trying breaks SmartClient - so the focus goes to the first field in error
         * that is on screen, or stays where it is; the notice carries the action that reveals it.
         */
        OB.ViewFormProperties.setFocusInErrorField = function () {
          var first = this.getFirstErrorItem ? this.getFirstErrorItem() : null;
          var errors, name, item;
          if (!isGoView(this.view) || !first || !first.etskinChooserHidden) {
            return coreFocusInError.apply(this, arguments);
          }
          errors = this.getErrors ? this.getErrors() || {} : {};
          for (name in errors) {
            if (Object.prototype.hasOwnProperty.call(errors, name)) {
              item = this.getItem(name);
              if (item && !item.etskinChooserHidden && item.isVisible && item.isVisible()) {
                this.focusInItem(name);
                return;
              }
            }
          }
        };
      }
    }

    if (isc.OBTabSetMain) {
      var coreTabSelected = isc.OBTabSetMain.getPrototype().tabSelected;
      isc.OBTabSetMain.addProperties({
        tabSelected: function () {
          var result = coreTabSelected ? coreTabSelected.apply(this, arguments) : undefined;
          try {
            syncMenuWindow();
          } catch (e) {
            // An open menu stays until it is closed by hand; nothing else depends on it.
          }
          return result;
        }
      });
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);

  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Etendo Modern Skin could not install the GO windows', e);
    }
  }
})();
