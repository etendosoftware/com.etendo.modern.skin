/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

/*
 * Etendo Modern Skin - side navigation.
 *
 * Moves the application menu out of the "Application" dropdown in the navigation bar and into a
 * permanent panel on the left, the way Etendo's React skin presents it. Controlled by the
 * ETSKIN_Navigation preference; anything other than 'sidebar' leaves the stock navigation alone.
 *
 * Nothing here needs a server round trip. OB.Application.menu is already the complete menu tree,
 * emitted per session by application-menu.js.ftl, and OBApplicationMenuTree#itemClick is already
 * the logic that turns one of its nodes into an open view - windows, classic windows, process
 * definitions, reports, forms, external links and recents all behave differently and that function
 * is where core encodes the differences. This file renders the tree and delegates every click to a
 * hidden instance of that class rather than restating any of it.
 *
 * The panel is one isc.Canvas containing plain HTML rather than a TreeGrid or a tree of Canvases.
 * SmartClient positions every canvas absolutely from measurements it takes itself, so a menu of
 * 277 nodes would be 277 absolutely positioned widgets to lay out and to fight for control of. One
 * canvas of markup styled from the stylesheet costs one layout pass, is scrolled by the browser,
 * and lets the panel look like the reference instead of like a grid.
 *
 * Same constraints as etendo-skin.js: concatenated into the global bundle and minified with
 * Crockford's JSMin, so conservative ES5 only - no let/const, no arrow functions, no template
 * literals, no trailing commas.
 */

(function () {
  'use strict';

  // Etendo GO's proportions: 240px open, 56px collapsed.
  var NAV_WIDTH = 240;
  var RAIL_WIDTH = 56;
  var COLLAPSE_KEY = 'etskin.nav.collapsed';
  var RECENT_LIST = 'UINAVBA_MenuRecentList';

  var sidebar = null; // the isc.Canvas
  var menuDelegate = null; // an OBApplicationMenuTree, used only for itemClick
  var menuData = null;
  var grouped = false; // menuData is GO's grouping of the menu rather than the menu itself
  // The index path of the node whose window is open, kept because the row it names is not always
  // the row that carries the mark; see applyCurrent.
  var currentPath = null;
  var syncTimer = null; // debounce handle for the tab-bar observer, see watchTabBar

  // ------------------------------------------------------------------ gates

  function properties() {
    return (typeof OB !== 'undefined' && OB && OB.Properties) || {};
  }

  function wanted() {
    // etendo-skin.js publishes OB.ETSkin only when it decided the skin is on, so this follows the
    // ETSKIN_Enabled and SKINLEG_LegacySkin decisions without repeating them.
    if (typeof OB === 'undefined' || !OB || !OB.ETSkin) {
      return false;
    }
    // Portal users get a navigation bar of their own and no application menu, so there would be
    // nothing to put in the panel.
    if (OB.User && OB.User.isPortal) {
      return false;
    }
    // A popup is a window the application opened for one process, one classic form or one help
    // page. It carries its own layout and the user cannot navigate away from it, so a navigation
    // panel there is dead weight that steals half the width of a deliberately small window.
    if (isPopupDocument()) {
      return false;
    }
    var mode = properties().ETSKIN_Navigation;
    return !mode || mode === 'sidebar';
  }

  /*
   * Three independent marks, because the core opens popups in three shapes and no single one of
   * them covers all three: ob-classic-window.js, ob-classic-help.js and ob-classic-popup.js append
   * hideMenu=true to the url they load; OB.Utilities.openProcessPopup names the window it opens
   * PROCESS; and any window.open leaves an opener behind, which a plain tab does not, since
   * browsers give target=_blank links no opener by default. Reading top can throw when the
   * document is framed by another origin, hence the try.
   */
  function isPopupDocument() {
    try {
      if (String(window.location.search || '').indexOf('hideMenu=true') !== -1) {
        return true;
      }
      if (window.name === 'PROCESS' || (window.top && window.top.name === 'PROCESS')) {
        return true;
      }
      if (window.opener) {
        return true;
      }
    } catch (ignored) {
      // Cross-origin top: nothing to read, and the shapes above already answered for our own frames.
    }
    return false;
  }

  // ------------------------------------------------------------------- html

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .split('&')
      .join('&amp;')
      .split('<')
      .join('&lt;')
      .split('>')
      .join('&gt;')
      .split('"')
      .join('&quot;');
  }

  /*
   * Optional per section artwork, as {"<top level title>": "<data uri or url>"}. Nothing publishes
   * it yet, so every section falls back to its monogram; the shape is fixed here so that when the
   * icons do arrive nothing in the rendering has to change.
   *
   * The key is the title because a folder node in OB.Application.menu carries nothing else - no
   * id, no value, no window. Top level titles are unique, and a provider that emits this map
   * server side sees the same translations the menu was built with, so the key holds in every
   * language. See the README for how such a provider is wired without touching core.
   */
  function navIcons() {
    return (OB.ETSkin && OB.ETSkin.navIcons) || null;
  }

  function artworkFor(node) {
    var icons = navIcons();
    var src = icons && node && node.title ? icons[node.title] : null;
    return typeof src === 'string' && src ? src : null;
  }

  // The menu carries more types than there are useful shapes; several collapse onto one icon.
  function iconFor(node) {
    var type = node.type;
    if (type === 'folder') {
      return 'folder';
    }
    if (type === 'report') {
      return 'report';
    }
    if (type === 'form') {
      return 'form';
    }
    if (type === 'view') {
      return 'view';
    }
    if (type === 'external') {
      return 'external';
    }
    if (
      type === 'process' ||
      type === 'processManual' ||
      type === 'processDefinition'
    ) {
      return 'process';
    }
    return 'window';
  }

  /*
   * Distinct glyphs for the top level sections.
   *
   * A folder node in OB.Application.menu carries a translated title and nothing else - no id, no
   * value, no window - so there is no stable key to hang a shipped drawing on, and any installed
   * module may add a section of its own. Two passes cover both halves of that: the title is matched
   * against a small table of the words the standard sections are named with, in English and in
   * Spanish, and whatever is left over takes the next unused glyph from the pool. So the usual
   * sections get the glyph that means them, an unknown section still gets one of its own, and no
   * two sections in a menu ever share one - which is the whole job the rail needs done.
   *
   * This replaces the monogram the rail used to draw. A monogram is always available and always
   * distinct, but "GS MD PM WM PM MR SM PS FM" down a 52px strip is a column of initials, not an
   * index: two of them were even the same. Artwork from a provider still wins over all of this.
   */
  var SECTION_POOL = [
    'sliders', 'layers', 'inbound', 'package', 'factory', 'clipboard', 'trend',
    'briefcase', 'card', 'star', 'tag', 'flag', 'compass', 'grid', 'bolt'
  ];

  // Matched as substrings of the lowercased title, in the order written here: 'setup' is looked for
  // before 'general' so that "General Setup" is read as a setup section rather than a general one.
  var SECTION_WORDS = [
    ['master data', 'layers'],
    ['datos maestros', 'layers'],
    ['procurement', 'inbound'],
    ['compras', 'inbound'],
    ['warehouse', 'package'],
    ['almac', 'package'],
    ['production', 'factory'],
    ['producci', 'factory'],
    ['requirement', 'clipboard'],
    ['planificaci', 'clipboard'],
    ['sales', 'trend'],
    ['ventas', 'trend'],
    ['project', 'briefcase'],
    ['proyecto', 'briefcase'],
    ['financial', 'card'],
    ['financiera', 'card'],
    ['finanzas', 'card'],
    ['setup', 'sliders'],
    ['configuraci', 'sliders'],
    ['general', 'sliders']
  ];

  var sectionGlyphs = null;

  function computeSectionGlyphs() {
    var used = {};
    var out = [];
    var i, j, title, glyph;

    for (i = 0; i < menuData.length; i++) {
      title = String(menuData[i].title || '').toLowerCase();
      glyph = null;
      for (j = 0; j < SECTION_WORDS.length; j++) {
        if (title.indexOf(SECTION_WORDS[j][0]) !== -1 && !used[SECTION_WORDS[j][1]]) {
          glyph = SECTION_WORDS[j][1];
          break;
        }
      }
      if (glyph) {
        used[glyph] = true;
      }
      out.push(glyph);
    }

    for (i = 0; i < out.length; i++) {
      if (out[i]) {
        continue;
      }
      for (j = 0; j < SECTION_POOL.length; j++) {
        if (!used[SECTION_POOL[j]]) {
          out[i] = SECTION_POOL[j];
          used[SECTION_POOL[j]] = true;
          break;
        }
      }
      // A menu with more sections than the pool has glyphs: the tail repeats rather than going
      // blank, because a glyph shared with a section eight rows away still tells this one from its
      // neighbours.
      if (!out[i]) {
        out[i] = SECTION_POOL[i % SECTION_POOL.length];
      }
    }
    return out;
  }

  function sectionGlyph(index) {
    if (!sectionGlyphs) {
      sectionGlyphs = computeSectionGlyphs();
    }
    return sectionGlyphs[index] || SECTION_POOL[0];
  }

  function iconMarkup(node, depth, index) {
    // Only sections carry a glyph, as in Etendo GO. Everything below a section hangs off the thin
    // guide line under that glyph instead, which is what keeps a 277 entry tree quiet.
    if (depth > 0) {
      return '';
    }
    // Artwork is a section level idea, so it is only consulted for the top of the tree.
    var art = depth === 0 ? artworkFor(node) : null;
    if (art) {
      return '<img class="etskin-nav-art" src="' + esc(art) + '" alt="">';
    }
    if (depth === 0) {
      return '<span class="etskin-nav-icon etskin-nav-icon-sec-' + (node.etskinGlyph || sectionGlyph(index)) + '"></span>';
    }
    return '<span class="etskin-nav-icon etskin-nav-icon-' + iconFor(node) + '"></span>';
  }

  // -------------------------------------------------------------- grouping

  /*
   * Etendo GO's arrangement of the menu: a few named groups - General, Commercial, Operations,
   * Finance, System - each holding short categories, and each category its windows in one flat
   * list. Classic's menu is sixteen module folders, each with Transactions, Analysis Tools and Setup
   * folders under it, so the panel regroups the session's own menu into that shape. Nothing is
   * added and nothing the role cannot see appears: every entry below is an entry of
   * OB.Application.menu, and a category the role has nothing in is left out.
   *
   * Categories name their sources by menu id, never by title, so the map holds in every language
   * and survives a client renaming a folder. OB.Application.menu does not carry them - a folder has no
   * id at all, and an entry's id is that of what it opens - so NavMenuFoldersComponent publishes them
   * as OB.ETSkinMenuFolders, a tree of the same shape. Without it, or when the two disagree, the
   * panel keeps the stock tree.
   *
   * A source brings its whole subtree, and a more specific source claimed by another category is
   * taken out of it - Security lives inside General Setup, Invoices inside Financial Management.
   * Inside a source, the entries are listed flat, a Transactions folder is opened into that list, the
   * Analysis Tools and Setup folders of every source in the category are merged into one Analysis
   * and one Setup group at the end, and any other folder stays a group of its own. Whatever no
   * category claims is not lost: it goes under Other, folder and all.
   *
   * Labels are skin words (ETSKIN_L_nav*), with the English written here as the fallback.
   */
  var NAV_SECTIONS = [
    { key: 'General', items: [{ key: 'Home', glyph: 'home', home: true }] },
    {
      key: 'Commercial',
      items: [
        // Business Partner, Business Partner Info, Business Partner Setup, Partner Relations.
        { key: 'Partners', glyph: 'users', from: ['110', '394', '800238', '263'] },
        { key: 'Sales', glyph: 'trend', from: ['166'] },
        { key: 'Projects', glyph: 'briefcase', from: ['160'] }
      ]
    },
    {
      key: 'Operations',
      items: [
        { key: 'Purchases', glyph: 'inbound', from: ['203'] },
        // Warehouse Management, with the EMOS warehouse windows that sit in it.
        { key: 'Inventory', glyph: 'package', from: ['800243'] },
        { key: 'Production', glyph: 'factory', from: ['800121'] },
        { key: 'Planning', glyph: 'clipboard', from: ['800212'] },
        // Product, Product Setup, Pricing, Product Management.
        { key: 'Products', glyph: 'tag', from: ['126', '800239', '800240', '183'] }
      ]
    },
    {
      key: 'Finance',
      items: [
        // Receivables and Payables, and the EMOS Invoice Monitor and Collections and Payments.
        {
          key: 'Billing',
          glyph: 'card',
          from: ['236', 'D939BE0C45FF7EB26F0EDC55B9D26D0C', 'DEE2FB4A19279DE4D82BCF06D2B9ACD2']
        },
        { key: 'Accounting', glyph: 'book', from: ['800252'] },
        { key: 'Assets', glyph: 'building', from: ['345'] },
        // Performance Measurement, Business Intelligence and the EMOS Financial Overview.
        { key: 'Analysis', glyph: 'chart', from: ['158', '1004400006', '18A7370FE2B581C2A84F2E17C2C63915'] }
      ]
    },
    {
      key: 'System',
      items: [
        { key: 'Settings', glyph: 'sliders', from: ['155'] },
        { key: 'Security', glyph: 'shield', from: ['367'] },
        { key: 'Dictionary', glyph: 'layers', from: ['153'] },
        // Jobs.
        { key: 'Processes', glyph: 'bolt', from: ['3A59F70F148D4BE49D38E9935CDFE3C7'] },
        // Etendo RX, and Integrations Configuration from General Setup.
        {
          key: 'Integrations',
          glyph: 'plug',
          from: ['56A75A71AF5A4CB6AD2C0BB1BBE7EA7C', '8AC84D3FD82742C0B064787BCECC412C']
        },
        // Copilot.
        { key: 'Assistant', glyph: 'star', from: ['BD2E5BFEF0AE4D02ADA0902974C2B66D'] },
        // The rest of Service: Knowledge and Reports.
        { key: 'Support', glyph: 'compass', from: ['271'] },
        { key: 'Other', glyph: 'grid', other: true }
      ]
    }
  ];

  var NAV_FALLBACK = {
    General: 'General', Commercial: 'Commercial', Operations: 'Operations', Finance: 'Finance',
    System: 'System', Home: 'Home', Partners: 'Partners', Sales: 'Sales', Projects: 'Projects',
    Purchases: 'Purchases', Inventory: 'Inventory', Production: 'Production', Planning: 'Planning',
    Products: 'Products', Billing: 'Billing', Accounting: 'Accounting', Assets: 'Assets',
    Analysis: 'Analysis', Settings: 'Settings', Security: 'Security', Dictionary: 'Dictionary',
    Processes: 'Processes', Integrations: 'Integrations', Assistant: 'AI assistant',
    Support: 'Support', Other: 'Other', SubAnalysis: 'Analysis', SubSetup: 'Setup'
  };

  // Deprecated.
  var NAV_HIDDEN = { '800257': true };

  // Every module's Transactions folder: opened into the category's own list.
  var NAV_FLATTEN = {
    '800242': true, '800244': true, '800245': true, '800247': true, '800249': true,
    '800250': true, '800253': true, '800254': true
  };

  // Every module's Analysis Tools and Setup folders, and Business Partner Setup: merged, per
  // category, into one group each.
  var NAV_MERGE = {
    '280': 'SubAnalysis', '800075': 'SubAnalysis', '800076': 'SubAnalysis', '800077': 'SubAnalysis',
    '800078': 'SubAnalysis', '800079': 'SubAnalysis', '800081': 'SubAnalysis', '800141': 'SubAnalysis',
    '164': 'SubSetup', '167': 'SubSetup', '272': 'SubSetup', '800189': 'SubSetup', '800233': 'SubSetup',
    '800248': 'SubSetup', '800251': 'SubSetup', '800255': 'SubSetup', '800256': 'SubSetup',
    '800238': 'SubSetup'
  };

  function navLabel(key) {
    var labels = OB.ETSkin && OB.ETSkin.labels;
    var name = 'nav' + key;
    return (labels && labels[name]) || NAV_FALLBACK[key] || key;
  }

  function isFolderNode(node) {
    return !!(node && node.submenu && node.submenu.length);
  }

  /*
   * Gives every node of the menu the menu id its twin in OB.ETSkinMenuFolders carries. False, and the
   * caller keeps the stock tree, the moment the two shapes disagree: grouping a menu by ids that
   * belong to some other menu would put windows in the wrong place without anyone noticing.
   */
  function annotateFolders(list, ids) {
    var i, node, id;
    if (!list || !ids || ids.length !== list.length) {
      return false;
    }
    for (i = 0; i < list.length; i++) {
      node = list[i];
      id = ids[i];
      if (isFolderNode(node)) {
        if (!id || typeof id !== 'object' || typeof id[0] !== 'string' || !annotateFolders(node.submenu, id[1])) {
          return false;
        }
        node.etskinMenuId = id[0];
      } else if (typeof id !== 'string' || !id) {
        return false;
      } else {
        node.etskinMenuId = id;
      }
    }
    return true;
  }

  function menuIdOf(node) {
    return String(node.etskinMenuId || '');
  }

  function hasClaimedDescendant(node, claims) {
    var i;
    if (!isFolderNode(node)) {
      return false;
    }
    for (i = 0; i < node.submenu.length; i++) {
      if (claims[menuIdOf(node.submenu[i])] || hasClaimedDescendant(node.submenu[i], claims)) {
        return true;
      }
    }
    return false;
  }

  // The tree the panel renders, or null to keep the stock one. Does not modify the menu's entries
  // beyond the menu ids annotateFolders writes; the groups it returns are new objects.
  function groupMenu(menu, folders) {
    var claims = {};
    var buckets = {};
    var out = [];
    var s, c, i, section, category, bucket, items, mergeKey;

    if (!menu || !menu.length || !annotateFolders(menu, folders)) {
      return null;
    }

    for (s = 0; s < NAV_SECTIONS.length; s++) {
      for (c = 0; c < NAV_SECTIONS[s].items.length; c++) {
        category = NAV_SECTIONS[s].items[c];
        buckets[category.key] = { flat: [], groups: [], merged: { SubAnalysis: [], SubSetup: [] } };
        for (i = 0; category.from && i < category.from.length; i++) {
          claims[category.from[i]] = category.key;
        }
      }
    }

    function addSource(key, node) {
      var b = buckets[key];
      var j, child, childId;
      if (!isFolderNode(node)) {
        b.flat.push(node);
        return;
      }
      // A source that is itself a Setup folder joins the category's Setup group.
      if (NAV_MERGE[menuIdOf(node)]) {
        b.merged[NAV_MERGE[menuIdOf(node)]] = b.merged[NAV_MERGE[menuIdOf(node)]].concat(node.submenu);
        return;
      }
      for (j = 0; j < node.submenu.length; j++) {
        child = node.submenu[j];
        childId = menuIdOf(child);
        if (NAV_HIDDEN[childId]) {
          continue;
        }
        if (claims[childId] && claims[childId] !== key) {
          addSource(claims[childId], child);
        } else if (!isFolderNode(child)) {
          b.flat.push(child);
        } else if (NAV_FLATTEN[childId]) {
          addSource(key, child);
        } else if (NAV_MERGE[childId]) {
          b.merged[NAV_MERGE[childId]] = b.merged[NAV_MERGE[childId]].concat(child.submenu);
        } else {
          b.groups.push(child);
        }
      }
    }

    function walk(list) {
      var j, node, id;
      for (j = 0; j < list.length; j++) {
        node = list[j];
        id = menuIdOf(node);
        if (NAV_HIDDEN[id]) {
          continue;
        }
        if (claims[id]) {
          addSource(claims[id], node);
        } else if (hasClaimedDescendant(node, claims)) {
          walk(node.submenu);
        } else if (isFolderNode(node)) {
          buckets.Other.groups.push(node);
        } else {
          buckets.Other.flat.push(node);
        }
      }
    }

    walk(menu);

    for (s = 0; s < NAV_SECTIONS.length; s++) {
      section = NAV_SECTIONS[s];
      for (c = 0; c < section.items.length; c++) {
        category = section.items[c];
        if (category.home) {
          out.push({ title: navLabel(category.key), etskinHome: true, etskinGlyph: category.glyph, etskinSection: section.key });
          continue;
        }
        bucket = buckets[category.key];
        items = bucket.flat.concat(bucket.groups);
        for (mergeKey in bucket.merged) {
          if (bucket.merged.hasOwnProperty(mergeKey) && bucket.merged[mergeKey].length) {
            items.push({ title: navLabel(mergeKey), type: 'folder', submenu: bucket.merged[mergeKey] });
          }
        }
        if (items.length) {
          out.push({
            title: navLabel(category.key),
            type: 'folder',
            submenu: items,
            etskinGlyph: category.glyph,
            etskinSection: section.key
          });
        }
      }
    }
    return out;
  }

  // Nodes are addressed by their index path into OB.Application.menu ("0.4.2") rather than by id:
  // folders have no id at all, and the path is what makes the lookup on click a walk of three
  // array indexes instead of a search of the whole tree.
  function nodeAt(path) {
    var parts = path.split('.');
    var list = menuData;
    var node = null;
    var i;
    for (i = 0; i < parts.length; i++) {
      if (!list) {
        return null;
      }
      node = list[Number(parts[i])];
      if (!node) {
        return null;
      }
      list = node.submenu;
    }
    return node;
  }

  function renderNodes(list, prefix, depth) {
    var html = [];
    var i, node, path, isFolder;
    var section = null;

    for (i = 0; i < list.length; i++) {
      node = list[i];
      path = prefix === '' ? String(i) : prefix + '.' + i;
      isFolder = !!(node.submenu && node.submenu.length);

      // The grouped tree's group titles, and the recent views at the end of General, as in GO.
      if (depth === 0 && node.etskinSection && node.etskinSection !== section) {
        if (section === 'General') {
          html.push(recentsSlot());
        }
        section = node.etskinSection;
        html.push('<div class="etskin-nav-section-title">' + esc(navLabel(section)) + '</div>');
      }

      html.push('<div class="etskin-nav-group">');
      html.push(
        '<button type="button" class="etskin-nav-row' +
          (depth === 0 ? ' etskin-nav-row-top' : '') +
          (isFolder ? ' etskin-nav-row-folder' : '') +
          '" data-p="' +
          path +
          '" style="--d:' +
          depth +
          '" title="' +
          esc(node.title) +
          '"' +
          (isFolder ? ' aria-expanded="false"' : '') +
          '>'
      );
      html.push(iconMarkup(node, depth, i));
      html.push('<span class="etskin-nav-label">' + esc(node.title) + '</span>');
      if (isFolder) {
        html.push('<span class="etskin-nav-chevron"></span>');
      }
      html.push('</button>');
      if (isFolder) {
        // The sub list draws the guide line its rows hang from, so it needs the depth as well.
        html.push('<div class="etskin-nav-sub" style="--d:' + (depth + 1) + '">');
        html.push(renderNodes(node.submenu, path, depth + 1));
        html.push('</div>');
      }
      html.push('</div>');
    }
    if (depth === 0 && section === 'General') {
      html.push(recentsSlot());
    }
    return html.join('');
  }

  function recentsSlot() {
    return '<div class="etskin-nav-recents-slot">' + renderRecents() + '</div>';
  }

  /*
   * The section title is carried on every tile as text as well as on its tooltip. The stylesheet
   * takes it out of the picture but leaves it in the accessibility tree, so the rail is nine named
   * buttons to a screen reader and nine glyphs to everyone else - which a tooltip alone would not
   * have managed, since a tooltip is not an accessible name.
   */
  function renderRail() {
    var html = [];
    var i, node, art;

    for (i = 0; i < menuData.length; i++) {
      node = menuData[i];
      art = artworkFor(node);
      // A gap between the groups, which have no titles in the rail.
      if (i > 0 && node.etskinSection && node.etskinSection !== menuData[i - 1].etskinSection) {
        html.push('<span class="etskin-nav-rail-gap"></span>');
      }
      html.push(
        '<button type="button" class="etskin-nav-tile' +
          (art ? '' : ' etskin-nav-icon-sec-' + (node.etskinGlyph || sectionGlyph(i))) +
          '" data-p="' +
          i +
          '" title="' +
          esc(node.title) +
          '">' +
          (art ? '<img class="etskin-nav-art" src="' + esc(art) + '" alt="">' : '') +
          '<span class="etskin-nav-tile-name">' +
          esc(node.title) +
          '</span>' +
          '</button>'
      );
    }
    return html.join('');
  }

  function recentEntries() {
    if (!OB.RecentUtilities || !OB.RecentUtilities.getRecentValue) {
      return [];
    }
    var recent = OB.RecentUtilities.getRecentValue(RECENT_LIST);
    return recent && recent.length ? recent : [];
  }

  function renderRecents() {
    var recent = recentEntries();
    var html = [];
    var i, title;

    if (!recent.length) {
      return '';
    }
    html.push('<div class="etskin-nav-recents">');
    html.push(
      '<div class="etskin-nav-recents-title">' +
        esc(label('OBKMO_RecentViews', 'Recent Views')) +
        '</div>'
    );
    html.push('<div class="etskin-nav-chips">');
    for (i = 0; i < recent.length && i < 6; i++) {
      title = recent[i].tabTitle || recent[i].title;
      if (!title) {
        continue;
      }
      html.push(
        '<button type="button" class="etskin-nav-chip" data-r="' +
          i +
          '" title="' +
          esc(title) +
          '">' +
          esc(title) +
          '</button>'
      );
    }
    html.push('</div></div>');
    return html.join('');
  }

  // Only labels core already ships are used. The panel deliberately has no strings of its own: a
  // new AD_MESSAGE would mean the module has to be reinstalled before the text appears, and an
  // English literal in a Spanish installation is worse than an icon with no caption.
  function label(key, fallback) {
    if (OB.I18N && OB.I18N.labels && OB.I18N.labels[key]) {
      return OB.I18N.labels[key];
    }
    return fallback;
  }

  /*
   * The collapsed state is written into the markup rather than added to it afterwards. The canvas
   * is created with its width and its contents in one object literal, so taking both from the same
   * read of the preference is the only arrangement in which the two cannot disagree. There is no
   * later moment to rely on instead: the panel is not in the document yet when install() finishes.
   */
  function panelClassName(isCollapsed) {
    return isCollapsed ? 'etskin-nav etskin-nav-collapsed' : 'etskin-nav';
  }

  function renderPanel(isCollapsed) {
    var menuLabel = label('UINAVBA_APPLICATION_MENU', 'Application');
    /*
     * The box narrows the tree down to what matches, which is filtering rather than searching, and
     * "Filter" is a label core already ships translated. The panel deliberately has no strings of
     * its own; see label() below for why.
     */
    var filterLabel = label('OBUIAPP_CalWidget_Filter', 'Filter');
    return (
      '<div class="' +
      panelClassName(isCollapsed) +
      '" role="navigation" aria-label="' +
      esc(menuLabel) +
      '">' +
      '<div class="etskin-nav-head">' +
      '<div class="etskin-nav-search">' +
      '<span class="etskin-nav-search-icon"></span>' +
      '<input type="text" class="etskin-nav-search-input" autocomplete="off" spellcheck="false" placeholder="' +
      esc(filterLabel) +
      '" aria-label="' +
      esc(menuLabel) +
      '">' +
      '</div>' +
      '<button type="button" class="etskin-nav-toggle" aria-label="' +
      esc(menuLabel) +
      '"></button>' +
      '</div>' +
      '<div class="etskin-nav-rail">' +
      renderRail() +
      '</div>' +
      '<div class="etskin-nav-body">' +
      // Grouped, the recents sit inside General and every group has its own title.
      (grouped
        ? ''
        : recentsSlot() + '<div class="etskin-nav-section-title">' + esc(menuLabel) + '</div>') +
      '<div class="etskin-nav-tree">' +
      renderNodes(menuData, '', 0) +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  // --------------------------------------------------------------- dom help

  function hasClass(el, name) {
    return (
      el.className && (' ' + el.className + ' ').indexOf(' ' + name + ' ') !== -1
    );
  }

  function closestWithClass(el, name) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (hasClass(node, name)) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function panel() {
    return document.querySelector('.etskin-nav');
  }

  // --------------------------------------------------------------- actions

  function toggleFolder(row) {
    var group = row.parentNode;
    var open = hasClass(group, 'etskin-nav-open');
    if (!open && hasClass(row, 'etskin-nav-row-top')) {
      closeOtherSections(group);
    }
    setClass(group, 'etskin-nav-open', !open);
    row.setAttribute('aria-expanded', open ? 'false' : 'true');
    // Opening or closing a folder changes which rows are on screen, and the mark is only ever put
    // on a row the user can see.
    applyCurrent(currentPath);
  }

  /*
   * One section open at a time, as in Etendo GO: opening a section folds the one that was open.
   * Only the top level behaves like this - folders inside a section keep whatever the user left
   * open - and a closed section keeps its inner folders' state for the next time it opens.
   */
  function closeOtherSections(keep) {
    var root = panel();
    if (!root) {
      return;
    }
    var rows = root.querySelectorAll('.etskin-nav-row-top.etskin-nav-row-folder');
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].parentNode !== keep && hasClass(rows[i].parentNode, 'etskin-nav-open')) {
        setClass(rows[i].parentNode, 'etskin-nav-open', false);
        rows[i].setAttribute('aria-expanded', 'false');
      }
    }
  }

  function setClass(el, name, on) {
    if (!el || on === hasClass(el, name)) {
      return;
    }
    if (on) {
      el.className = el.className ? el.className + ' ' + name : name;
    } else {
      el.className = trim(
        (' ' + el.className + ' ').split(' ' + name + ' ').join(' ')
      );
    }
  }

  function trim(value) {
    var out = String(value === null || value === undefined ? '' : value);
    while (out.charAt(0) === ' ') {
      out = out.substring(1);
    }
    while (out.length && out.charAt(out.length - 1) === ' ') {
      out = out.substring(0, out.length - 1);
    }
    return out;
  }

  /*
   * The rail's whole point: collapsed, it still says which section you are in. Without this the
   * 52px strip would be decoration, and hiding the tree would cost the user their bearings.
   */
  function updateRail(path) {
    var root = panel();
    if (!root) {
      return;
    }
    var section = path ? String(path).split('.')[0] : null;
    var tiles = root.querySelectorAll('.etskin-nav-tile');
    var i;
    for (i = 0; i < tiles.length; i++) {
      setClass(
        tiles[i],
        'etskin-nav-tile-current',
        section !== null && tiles[i].getAttribute('data-p') === section
      );
    }
  }

  /*
   * Fills exactly one row, and the rail tile for the section that row belongs to.
   *
   * The row that was opened is usually inside a folder that is closed - the tree starts closed and
   * a window opened from a recent chip or a bookmark never opened one - so it is in the markup but
   * not on the screen, and marking it would leave the expanded panel saying less about where the
   * user is than the 52px rail beside it does. When that happens the mark moves up to the section
   * the row belongs to, which is the section the rail fills, so the two never disagree. It comes
   * back down to the row itself as soon as the folder is opened, because every gesture that changes
   * which rows are visible calls this again. Inside an open section it stops at the nearest folder
   * that is on screen rather than jumping all the way up to the section.
   */
  function applyCurrent(path) {
    var root = panel();
    if (!root) {
      return;
    }
    var target = path
      ? root.querySelector('.etskin-nav-row[data-p="' + path + '"]')
      : null;
    var parts = path ? String(path).split('.') : [];
    while (target && target.offsetParent === null && parts.length > 1) {
      parts.pop();
      target = root.querySelector('.etskin-nav-row[data-p="' + parts.join('.') + '"]');
    }
    var rows = root.querySelectorAll('.etskin-nav-row');
    var i;
    for (i = 0; i < rows.length; i++) {
      setClass(rows[i], 'etskin-nav-current', rows[i] === target);
    }
    updateRail(path);
  }

  function markCurrent(row) {
    currentPath = row ? row.getAttribute('data-p') : null;
    applyCurrent(currentPath);
  }

  // The path of the first menu node that opens the given window, wherever in the tree it sits.
  function pathOfWindow(list, prefix, windowId) {
    var i, node, path, found;
    for (i = 0; i < list.length; i++) {
      node = list[i];
      path = prefix === '' ? String(i) : prefix + '.' + i;
      if (node.windowId && String(node.windowId) === windowId) {
        return path;
      }
      if (node.submenu && node.submenu.length) {
        found = pathOfWindow(node.submenu, path, windowId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /*
   * Keeps the panel in step with the tab strip, so closing a tab or switching to one opened from
   * somewhere else does not leave the highlight behind.
   *
   * The window the tab holds is what identifies it, not the label on it. A tab is renamed the
   * moment a record is selected in it - "Sales Invoice" becomes "Sales Invoice - 1000367 - 03-0..."
   * complete with the ellipsis the strip needs to fit it - and matching that against menu titles
   * found nothing, so the panel and the rail both went blank on exactly the screens a user spends
   * their day on. The title is still the fallback, for a tab that is not a window: the workspace,
   * and whatever a process definition opens.
   */
  /*
   * tabSet.tabSelected covers exactly one of the ways the active window tab changes, and this
   * skin's own users have found the other two: closing the active tab hands the highlight to
   * whichever tab SmartClient promotes next without calling tabSelected at all, and a tab opened
   * from a drill-down or a recent chip can become selected through a code path this file never
   * had a hook for. Patching each one by name means finding every such path first.
   *
   * The tab bar itself does not have that problem: whichever way the active tab changed, core
   * still has to mark it - the "Selected" class the stylesheet already keys off of is right there
   * in the DOM, on the same OBTabBarButtonMainTop element every time. Watching that class instead
   * of the API that moves it covers every path through one observer, including ones core adds
   * later.
   */
  function watchTabBar() {
    var bar = document.querySelector('.OBTabBarMain');
    if (!bar || typeof MutationObserver === 'undefined') {
      return;
    }
    var scheduleSync = function () {
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
      syncTimer = setTimeout(function () {
        syncTimer = null;
        syncCurrent();
        // The pane's windowId is not always set yet on the tick the tab becomes current - a
        // freshly opened window fills it in once its view has loaded. One more pass shortly after
        // catches that without polling for it.
        setTimeout(syncCurrent, 400);
      }, 60);
    };
    var observer = new MutationObserver(function (mutations) {
      var i;
      for (i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === 'class') {
          scheduleSync();
          return;
        }
      }
    });
    observer.observe(bar, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
      childList: true
    });
  }

  function syncCurrent() {
    var root = panel();
    if (!root || !OB.MainView || !OB.MainView.TabSet) {
      return;
    }
    var tab = OB.MainView.TabSet.getSelectedTab
      ? OB.MainView.TabSet.getSelectedTab()
      : null;
    var pane = tab && tab.pane;
    var windowId = pane && pane.windowId ? String(pane.windowId) : null;
    var title = (pane && pane.tabTitle) || (tab && (tab.title || tab.tabTitle));
    var rows = root.querySelectorAll('.etskin-nav-row');
    var i, labelEl;
    currentPath = null;
    if (windowId && menuData) {
      currentPath = pathOfWindow(menuData, '', windowId);
    }
    if (!currentPath && grouped && menuData[0] && menuData[0].etskinHome &&
        OB.MainView.TabSet.tabs && tab === OB.MainView.TabSet.tabs[0]) {
      currentPath = '0';
    }
    for (i = 0; !currentPath && title && i < rows.length; i++) {
      labelEl = rows[i].querySelector('.etskin-nav-label');
      if (labelEl && labelEl.textContent === title) {
        currentPath = rows[i].getAttribute('data-p');
        break;
      }
    }
    applyCurrent(currentPath);
  }

  function refreshRecents() {
    var root = panel();
    if (!root) {
      return;
    }
    var slot = root.querySelector('.etskin-nav-recents-slot');
    if (slot) {
      slot.innerHTML = renderRecents();
    }
  }

  /*
   * Every open goes through the core menu tree, which is the only code that knows how to turn a
   * menu node into a view, but it is called after clearing loadedWindowClassName on the view
   * manager. That global is written by the generated script of a window that is in development and
   * is never cleared again; ob-view-manager.js reads it in fetchViewCallback and lets it override
   * the name of the view it just fetched, so the first open of any other view - the one that has
   * to fetch, the second finds the class already defined - renders the last development window
   * instead. Clearing it here is safe: a fetch that really is a development window sets it again
   * from its own response.
   */
  function delegateClick(node) {
    try {
      if (OB.Layout && OB.Layout.ViewManager) {
        OB.Layout.ViewManager.loadedWindowClassName = null;
      }
    } catch (ignored) {
      // No view manager yet: nothing stale to clear.
    }
    menuDelegate.itemClick(node, 0);
  }

  function openNode(node, row) {
    if (!node) {
      return;
    }
    markCurrent(row);
    // Home is the workspace, which core keeps as the first tab and never lets close.
    if (node.etskinHome) {
      if (OB.MainView && OB.MainView.TabSet) {
        OB.MainView.TabSet.selectTab(0);
      }
      return;
    }
    delegateClick(node);
    refreshRecents();
  }

  // ---------------------------------------------------------------- search

  /*
   * Filtering is a class on the root plus a class on every group that contains no match. Every
   * subtree is open while filtering, so a hit four levels down is visible without the user having
   * to expand anything, and the moment the box is cleared the panel is back to whatever was open
   * before - the open state lives in classes on the groups and is never thrown away.
   */
  function filter(query) {
    var root = panel();
    if (!root) {
      return;
    }
    var q = trim(query).toLowerCase();
    var rows = root.querySelectorAll('.etskin-nav-row');
    var groups = root.querySelectorAll('.etskin-nav-group');
    var i, labelEl, hit;

    setClass(root, 'etskin-nav-filtering', q !== '');

    if (q === '') {
      for (i = 0; i < rows.length; i++) {
        setClass(rows[i], 'etskin-nav-hit', false);
      }
      for (i = 0; i < groups.length; i++) {
        setClass(groups[i], 'etskin-nav-off', false);
      }
      return;
    }

    for (i = 0; i < rows.length; i++) {
      labelEl = rows[i].querySelector('.etskin-nav-label');
      hit =
        !!labelEl && labelEl.textContent.toLowerCase().indexOf(q) !== -1;
      setClass(rows[i], 'etskin-nav-hit', hit);
    }

    // A group survives if it or anything under it matched. querySelector searches descendants and
    // the group's own row is one, so no separate bottom-up pass is needed.
    for (i = 0; i < groups.length; i++) {
      setClass(
        groups[i],
        'etskin-nav-off',
        !groups[i].querySelector('.etskin-nav-hit')
      );
    }
  }

  // -------------------------------------------------------------- collapse

  function collapsed() {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function rememberCollapsed(value) {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
    } catch (e) {
      // Private browsing, or site data turned off. The panel still works, it just forgets.
    }
  }

  /*
   * The width lives on the canvas and the visual state lives on a class, and the two have to move
   * together: an expanded body inside a rail-width box is a panel drawn clipped, which is what this
   * used to produce when it set the width and then found no markup to put the class on. Both sides
   * of the pair move here or neither does. The first paint needs nothing from this function -
   * renderPanel already wrote the class - so returning early costs nothing and cannot desynchronise.
   */
  function applyCollapsed(isCollapsed, focusSearch) {
    var root = panel();
    if (!sidebar || !root) {
      return;
    }
    sidebar.setWidth(isCollapsed ? RAIL_WIDTH : NAV_WIDTH);
    setClass(root, 'etskin-nav-collapsed', isCollapsed);
    applyCurrent(currentPath);
    if (!isCollapsed && focusSearch) {
      var input = root.querySelector('.etskin-nav-search-input');
      if (input) {
        input.focus();
      }
    }
  }

  // --------------------------------------------------------------- events

  function onClick(event) {
    var target = event.target || event.srcElement;
    if (!closestWithClass(target, 'etskin-nav')) {
      return;
    }

    var toggle = closestWithClass(target, 'etskin-nav-toggle');
    if (toggle) {
      var next = !collapsed();
      rememberCollapsed(next);
      applyCollapsed(next, false);
      return;
    }

    var search = closestWithClass(target, 'etskin-nav-search');
    if (search && collapsed()) {
      rememberCollapsed(false);
      applyCollapsed(false, true);
      return;
    }

    /*
     * A tile is a way back into the tree, not a second way to open a window: it expands the panel
     * and opens that section, which lands the user exactly where the tile pointed. Collapsed mode
     * therefore navigates rather than merely taking up less room.
     */
    var tile = closestWithClass(target, 'etskin-nav-tile');
    if (tile) {
      rememberCollapsed(false);
      applyCollapsed(false, false);
      var section = panel().querySelector(
        '.etskin-nav-row[data-p="' + tile.getAttribute('data-p') + '"]'
      );
      if (section) {
        closeOtherSections(section.parentNode);
        setClass(section.parentNode, 'etskin-nav-open', true);
        section.setAttribute('aria-expanded', 'true');
        section.scrollIntoView({ block: 'nearest' });
      }
      applyCurrent(currentPath);
      return;
    }

    var chip = closestWithClass(target, 'etskin-nav-chip');
    if (chip) {
      var recent = recentEntries()[Number(chip.getAttribute('data-r'))];
      if (recent) {
        markCurrent(null);
        delegateClick({ recentObject: recent, title: recent.tabTitle });
        refreshRecents();
      }
      return;
    }

    var row = closestWithClass(target, 'etskin-nav-row');
    if (!row) {
      return;
    }
    if (hasClass(row, 'etskin-nav-row-folder')) {
      toggleFolder(row);
      return;
    }
    openNode(nodeAt(row.getAttribute('data-p')), row);
  }

  function onInput(event) {
    var target = event.target || event.srcElement;
    if (!target || !hasClass(target, 'etskin-nav-search-input')) {
      return;
    }
    filter(target.value);
  }

  /*
   * SmartClient's event handler takes focus away from anything it does not know about on mousedown,
   * which is every native input inside a canvas. Stopping the event at the input is what lets the
   * search box keep the caret.
   */
  function onMouseDown(event) {
    var target = event.target || event.srcElement;
    if (target && hasClass(target, 'etskin-nav-search-input')) {
      event.stopPropagation();
    }
  }

  // --------------------------------------------------------------- install

  function hideApplicationMenuButton() {
    if (!OB.NavBar || !OB.NavBar.getMembers) {
      return;
    }
    var members = OB.NavBar.getMembers();
    var i, inner;
    for (i = 0; i < members.length; i++) {
      inner = members[i].getMembers && members[i].getMembers()[0];
      if (inner && inner.getClassName() === 'OBApplicationMenuButton') {
        members[i].hide();
        return;
      }
    }
  }

  function install() {
    var tabSet = OB.MainView && OB.MainView.TabSet;
    if (!tabSet || !OB.Application || !OB.Application.menu) {
      return;
    }

    // GO's groups when the folder ids came with the menu and match it, the stock tree otherwise.
    var regrouped = null;
    try {
      regrouped = groupMenu(OB.Application.menu, OB.ETSkinMenuFolders);
    } catch (e) {
      regrouped = null;
    }
    grouped = !!regrouped;
    menuData = regrouped || OB.Application.menu;
    menuDelegate = isc.OBApplicationMenuTree.create({ autoDraw: false });

    // One read, used for both halves of the initial state. See panelClassName.
    var startCollapsed = collapsed();

    sidebar = isc.Canvas.create({
      width: startCollapsed ? RAIL_WIDTH : NAV_WIDTH,
      height: '100%',
      overflow: 'hidden',
      canFocus: false,
      // The panel's open folders, scroll position and search text live in the DOM. A redraw would
      // rebuild the markup from `contents` and lose all three, and SmartClient redraws on every
      // resize unless told otherwise.
      redrawOnResize: false,
      styleName: 'etskinNavCanvas',
      contents: renderPanel(startCollapsed)
    });

    var row = isc.HLayout.create({ width: '100%', height: '100%' });
    OB.MainView.removeMember(tabSet);
    OB.MainView.addMember(row);
    row.addMember(sidebar);
    row.addMember(tabSet);

    /*
     * The tab set was sized for a VLayout, where its width was the breadth axis and '100%' meant
     * "as wide as the parent". In an HLayout width is the length axis, so '100%' would make it as
     * wide as the whole row and push it off the right edge by exactly the width of the panel.
     * SmartClient's star means "whatever is left", which is the intent, and height '100%' is now
     * the breadth axis and does stretch.
     */
    tabSet.setWidth('*');
    tabSet.setHeight('100%');

    // Capture, because SmartClient stops a good deal of what happens inside its own canvases.
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('mousedown', onMouseDown, true);

    // Kept alongside watchTabBar as a second, redundant trigger: cheap, and it still fires first
    // on the one path it does cover, which means one less mutation for the observer to chase.
    var previousTabSelected = tabSet.tabSelected;
    tabSet.tabSelected = function () {
      var result;
      if (previousTabSelected) {
        result = previousTabSelected.apply(this, arguments);
      }
      syncCurrent();
      return result;
    };
    watchTabBar();

    hideApplicationMenuButton();
    applyCollapsed(collapsed(), false);

    OB.ETSkin.nav = {
      canvas: sidebar,
      refreshRecents: refreshRecents,
      syncCurrent: syncCurrent
    };
  }

  // ------------------------------------------------------------------ main

  try {
    if (wanted() && OB.Layout && OB.Layout.initialize) {
      var originalInitialize = OB.Layout.initialize;
      OB.Layout.initialize = function () {
        var result = originalInitialize.apply(this, arguments);
        try {
          install();
        } catch (e) {
          // A panel that fails to build must not cost the user the application. The stock
          // Application menu is still in the navigation bar at this point, because hiding it is
          // the last thing install does.
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Etendo Modern Skin could not build the side navigation', e);
          }
        }
        return result;
      };
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Etendo Modern Skin side navigation is unavailable', e);
    }
  }
})();
