/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

/*
 * Etendo Modern Skin - navigation bar.
 *
 * The bar follows Etendo GO's top bar: 62px on the same pale grey as the side navigation, the title
 * of the open view on the left with where it sits in the menu under it, a rounded search field in
 * the middle, and the utilities as quiet 40px glyphs on the right. Every control in it is one core
 * already ships: the search field is the stock Quick Launch - same flyout, same shortcut, same
 * translated label - moved to the middle and drawn as a field, and the title is read from the tab
 * that is selected and the menu that opened it, so it is never a control that does nothing.
 *
 * Stock Classic packs every utility control against the left edge of the top bar as text buttons -
 * "Alerts (1)", "Help", "admin" - and puts the logos on the right. Etendo's React skin does the
 * opposite and does it with one gesture: the brand sits with the navigation on the left, and the
 * utilities are a single tray on the right, a soft pill holding round icon buttons. This file
 * makes Classic's navigation bar read the same way.
 *
 * Only two things here cannot be done from the stylesheet, and they are the only two things this
 * file does to the layout:
 *
 *   - Member order. OB.TopLayout is an HLayout of [left spacer, navbar, middle spacer, logos].
 *     CSS cannot reorder absolutely positioned canvases, so the members are re-ordered to
 *     [logos, spacers, navbar].
 *   - Measurements. SmartClient writes width and height inline on every canvas from numbers it
 *     took itself, so a 70x30 text button stays 70x30 whatever the stylesheet says. The buttons
 *     are re-measured to 40x40 here and everything else about them is styling.
 *
 * The rest is bookkeeping so the styling survives: OBQuickRun swaps the wrapper's styleName to
 * OBNavBarComponentSelected while its flyout is open and back again when it closes, which would
 * drop the marker class the stylesheet keys on - so setStyleName is wrapped to re-append it.
 *
 * Same constraints as etendo-skin.js: concatenated into the global bundle and minified with
 * Crockford's JSMin, so conservative ES5 only - no let/const, no arrow functions, no template
 * literals, no trailing commas.
 */

(function () {
  'use strict';

  // 40px buttons, and 8px above and below a 46px tray: GO's 62px bar.
  var BUTTON = 40;
  var GAP = 8;
  /*
   * The tray's own padding, which has to match the padding the stylesheet gives .OBNavBarToolStrip:
   * a ToolStrip is paddingAsLayoutMargin, so its CSS padding is its layout margin and the height it
   * needs is the button plus that padding twice. A 46px tray under 4px margins is a 54px bar.
   */
  var TRAY_PAD = 3;
  // Between two buttons in the tray: GO's 4px, so the glyphs read as one quiet group.
  var TRAY_GAP = 4;
  // The search field: GO's 44px pill, as wide as the bar allows up to its 480px.
  var SEARCH_HEIGHT = 44;
  var SEARCH_MAX = 480;
  var SEARCH_MIN = 180;
  // The title column: GO caps it at 320px and truncates.
  var TITLE_MAX = 320;
  var TITLE_MIN = 140;
  // The brand column matches the side navigation, so the title starts over the content.
  var BRAND_WIDTH = 240;
  var BASE_STYLE = 'OBNavBarComponent';
  /*
   * A tray member narrower than this cannot be clicked, so it is not a control: it is a component
   * that measured itself at nothing. The SmartClient debug menu does exactly that - it draws one
   * pixel wide - and stretched to the tray's height it became a hairline inside the pill that no
   * gesture could reach and that still counted as one of the shapes up there.
   */
  var USABLE = 16;
  // Every marker starts with this, which is what lets a repeat setStyleName strip the old one.
  var MARKER = 'etskin-tray-';

  // The inner widget's class name is the only reliable way to tell one wrapper from another: the
  // three text buttons all share the OBNavBarTextButton styleName, so the stylesheet cannot.
  var ROLES = {
    OBAlertIcon: 'alert',
    OBHelpAbout: 'help',
    OBUserProfile: 'profile',
    OBLogout: 'logout'
  };

  // ------------------------------------------------------------------ gates

  function wanted() {
    // etendo-skin.js publishes OB.ETSkin only when it decided the skin is on, so this follows the
    // ETSKIN_Enabled and SKINLEG_LegacySkin decisions without repeating them.
    return typeof OB !== 'undefined' && !!OB && !!OB.ETSkin && !!OB.TopLayout && !!OB.NavBar;
  }

  // ----------------------------------------------------------------- marker

  /*
   * Keeps a marker class on a wrapper for good. OBQuickRun calls setStyleName on the wrapper twice
   * per flyout - once with 'OBNavBarComponentSelected' and once with 'OBNavBarComponent' - so the
   * marker has to be re-appended on every call rather than written once.
   */
  function keepMarked(wrapper, marker) {
    var original = wrapper.setStyleName;

    wrapper.etskinMarker = marker;
    wrapper.setStyleName = function (style) {
      var base = String(style || BASE_STYLE);
      var cut = base.indexOf(' ' + MARKER);
      if (cut !== -1) {
        base = base.substring(0, cut);
      }
      return original.call(this, base + ' ' + this.etskinMarker);
    };
    wrapper.setStyleName(wrapper.styleName || BASE_STYLE);
  }

  function remark(wrapper, marker) {
    wrapper.etskinMarker = marker;
    wrapper.setStyleName(wrapper.styleName || BASE_STYLE);
  }

  // ----------------------------------------------------------------- alerts

  function countOf(title) {
    var text = title === null || title === undefined ? '' : String(title);
    var digits = '';
    var i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (ch >= '0' && ch <= '9') {
        digits += ch;
      }
    }
    return digits === '' ? 0 : parseInt(digits, 10);
  }

  /*
   * The bell carries a dot rather than a number. The count is not lost: the full stock label,
   * already translated and already formatted, becomes the button's tooltip, which is more than the
   * bare "Alerts (1)" said and costs no width in the tray.
   */
  function trackAlerts(wrapper, button) {
    var original = button.setTitle;

    function reflect(title) {
      remark(
        wrapper,
        MARKER + 'item ' + MARKER + 'alert' + (countOf(title) > 0 ? ' ' + MARKER + 'alert-on' : '')
      );
      if (button.setPrompt) {
        button.setPrompt(title === null || title === undefined ? '' : String(title));
      }
    }

    button.setTitle = function (title) {
      reflect(title);
      // The title is emptied because the stylesheet paints the bell as a mask on the button and a
      // label would sit on top of it. OB.I18N.getLabel calls this back asynchronously whenever the
      // alert manager refreshes, which is what keeps the dot honest.
      return original.call(this, '');
    };
    reflect(button.title);
    original.call(button, '');
  }

  // ---------------------------------------------------------------- profile

  function firstLetters(user) {
    var first = user.firstName ? String(user.firstName) : '';
    var last = user.lastName ? String(user.lastName) : '';
    var name;

    if (first && last) {
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }
    name = String(user.name || user.userName || '');
    if (!name) {
      return '•';
    }
    return name.substring(0, 2).toUpperCase();
  }

  /*
   * An avatar rather than an icon, because the user name is the one thing in the tray worth
   * keeping: Classic users switch role, client and organisation from this menu, and the initials
   * say which identity is loaded. The full name stays as the tooltip.
   */
  function makeAvatar(button) {
    var user = (OB && OB.User) || {};
    var full = button.title ? String(button.title) : String(user.name || '');

    if (button.setPrompt && full) {
      button.setPrompt(full);
    }
    button.setTitle(firstLetters(user));
  }

  // ------------------------------------------------------------------ sizes

  function resize(canvas, width, height) {
    if (canvas.setWidth) {
      canvas.setWidth(width);
    }
    if (canvas.setHeight) {
      canvas.setHeight(height);
    }
  }

  /*
   * A quick launch button already is an icon and the stylesheet already knows it by its own
   * styleName, so anything the stylesheet can name is a round icon chip. Anything else is a navbar
   * component from a module we know nothing about - it may well be a text button, and clipping it
   * to 40px would leave a word cut in half - so it keeps its width and only takes the pill.
   */
  function isIcon(inner) {
    var role = ROLES[inner.getClassName()];
    var style = inner.styleName;
    return !!role || style === 'OBNavBarCreateNew' || style === 'OBQuickLaunch';
  }

  /*
   * The global "create new" launcher is the one control left out of the tray.
   *
   * It opens a list of windows to create a record in, and every window on that list is one keystroke
   * away in the navigation panel, where the same list is already a tree with a filter box over it.
   * What it cost was a chip that looks exactly like the New button on the window toolbar under it
   * and does something else - two plus signs, one screen. Etendo's React skin ships no global one
   * either; its tray is four buttons. A deployment that wants it back sets OB.ETSkin.trayCreateNew.
   */
  function dropped(inner) {
    return !OB.ETSkin.trayCreateNew && inner.styleName === 'OBNavBarCreateNew';
  }

  // ----------------------------------------------------------------- search

  var searchWrapper = null;

  // The quick launch and the create new launcher are the same class; only the style tells them apart.
  function isSearch(inner) {
    return inner.getClassName() === 'OBQuickLaunch' && inner.styleName === 'OBQuickLaunch';
  }

  /*
   * The field shows the launcher's own tooltip as its placeholder - "Quick Launch", already
   * translated by core - so the skin adds no string. It is written as a custom property on the root
   * because the stylesheet draws it with content: var(...), which survives every redraw SmartClient
   * does of the button, where a span added to the markup would not.
   */
  function searchLabel(inner) {
    var text = inner.itemPrompt || inner.prompt || '';
    try {
      document.documentElement.style.setProperty('--sk-search-label', JSON.stringify(String(text)));
    } catch (ignored) {
      // No custom properties: the field still has its glyph and still opens the launcher.
    }
  }

  function sizeSearch(width) {
    var inner = searchWrapper && searchWrapper.getMembers ? searchWrapper.getMembers()[0] : null;
    if (!inner) {
      return;
    }
    resize(searchWrapper, width, SEARCH_HEIGHT);
    resize(inner, width, SEARCH_HEIGHT);
  }

  // ------------------------------------------------------------------ title

  var titleCanvas = null;
  var titleTimer = null;

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;');
  }

  // The titles of the menu nodes from the top down to the first node that opens the window, or null.
  function menuTrail(list, windowId, title, trail) {
    var i, node, found;
    for (i = 0; list && i < list.length; i++) {
      node = list[i];
      if ((windowId && node.windowId && String(node.windowId) === windowId) ||
          (!windowId && title && node.title === title && !(node.submenu && node.submenu.length))) {
        return trail.concat([node.title]);
      }
      if (node.submenu && node.submenu.length) {
        found = menuTrail(node.submenu, windowId, title, trail.concat([node.title]));
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /*
   * The title is the menu's name for the window rather than the tab's label, because a tab is renamed
   * the moment a record is selected in it ("Sales Invoice - 1000367 - 03-0...") and GO's title names
   * the view, not the record. The path above it is the breadcrumb. A tab that no menu entry opens -
   * the workspace, a process - keeps its own label and has no breadcrumb.
   */
  function currentTitle() {
    var tabSet = OB.MainView && OB.MainView.TabSet;
    var tab = tabSet && tabSet.getSelectedTab ? tabSet.getSelectedTab() : null;
    var pane = tab && tab.pane;
    var windowId = pane && pane.windowId ? String(pane.windowId) : null;
    var label = (pane && pane.tabTitle) || (tab && (tab.title || tab.tabTitle)) || '';
    var menu = OB.Application && OB.Application.menu;
    var trail = menu ? menuTrail(menu, windowId, windowId ? null : label, []) : null;
    if (trail && trail.length) {
      return { title: trail[trail.length - 1], crumb: trail.slice(0, trail.length - 1).join(' / ') };
    }
    return { title: label, crumb: '' };
  }

  function renderTitle() {
    var t;
    if (!titleCanvas) {
      return;
    }
    t = currentTitle();
    titleCanvas.setContents(
      '<div class="etskin-top-title" title="' + esc(t.title) + '">' +
        '<span class="etskin-top-title-main">' + esc(t.title) + '</span>' +
        (t.crumb ? '<span class="etskin-top-title-crumb">' + esc(t.crumb) + '</span>' : '') +
      '</div>'
    );
  }

  function scheduleTitle() {
    if (titleTimer) {
      clearTimeout(titleTimer);
    }
    titleTimer = setTimeout(function () {
      titleTimer = null;
      renderTitle();
      // A window that has just opened fills in its windowId once its view has loaded.
      setTimeout(renderTitle, 400);
    }, 60);
  }

  /*
   * Whichever way the selected tab changes - a click, a close that promotes the next tab, a drill
   * down - core marks the new one with the Selected class on the tab bar, so watching that class
   * covers every path with one observer. tabSelected is kept as a second, earlier trigger.
   */
  function watchTabs() {
    var tabSet = OB.MainView && OB.MainView.TabSet;
    var bar = document.querySelector('.OBTabBarMain');
    var previous;
    if (tabSet) {
      previous = tabSet.tabSelected;
      tabSet.tabSelected = function () {
        var result = previous ? previous.apply(this, arguments) : undefined;
        scheduleTitle();
        return result;
      };
    }
    if (bar && typeof MutationObserver !== 'undefined') {
      new MutationObserver(scheduleTitle).observe(bar, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true,
        childList: true
      });
    }
  }

  function makeTitle() {
    if (!titleCanvas) {
      titleCanvas = isc.Canvas.create({
        width: TITLE_MAX,
        height: BUTTON + 2 * TRAY_PAD,
        overflow: 'hidden',
        canFocus: false,
        redrawOnResize: false,
        styleName: 'etskinTopTitle',
        contents: ''
      });
    }
    return titleCanvas;
  }

  // ------------------------------------------------------------------ sizes

  /*
   * The title and the field share what the brand and the tray leave. The title takes up to 320px of
   * it, the field up to 480 - and the field gives way first on a narrow window, down to 180 - and
   * the two spacers around the field split the rest evenly, which is what centres it between the
   * title and the tray. Their widths are numbers rather than stars because the stock spacers of the
   * bar are stars too, and a star beside a star shares nothing evenly; the stock ones are empty, so
   * they are narrowed to nothing and the two spacers here do their job.
   */
  function fit() {
    var top = OB.TopLayout;
    var members = top.getMembers() || [];
    // The room the bar is given, not the bar: once its members overflow, the bar measures wider than
    // the page, and fitting to that would feed the overflow back into itself.
    var total = top.parentElement && top.parentElement.getInnerWidth ? top.parentElement.getInnerWidth() : isc.Page.getWidth();
    var brand = top.etskinBrand ? top.etskinBrand.getVisibleWidth() : 0;
    var tray = OB.NavBar.getVisibleWidth ? OB.NavBar.getVisibleWidth() : 0;
    var stock = 0;
    var free, title, search, side, i, member;

    for (i = 0; i < members.length; i++) {
      member = members[i];
      if (member !== top.etskinBrand && member !== titleCanvas && member !== searchWrapper &&
          member !== OB.NavBar && member !== top.etskinEdge &&
          member !== top.etskinBeforeSearch && member !== top.etskinAfterSearch &&
          member.setWidth && !(member.getMembers && member.getMembers().length)) {
        member.setWidth(1);
        stock++;
      }
    }
    // What is left once the brand, the tray, the edge spacer, the bar's right margin and the emptied
    // stock spacers have their pixels.
    free = total - brand - tray - (top.etskinEdge ? 8 : 0) - (top.layoutRightMargin || 0) - stock;
    title = Math.max(TITLE_MIN, Math.min(TITLE_MAX, Math.round(free * 0.3)));
    search = Math.max(SEARCH_MIN, Math.min(SEARCH_MAX, free - title - 48));
    side = Math.max(8, Math.floor((free - title - search) / 2));
    if (titleCanvas) {
      titleCanvas.setWidth(title);
    }
    if (searchWrapper) {
      sizeSearch(search);
      top.etskinBeforeSearch.setWidth(side);
      top.etskinAfterSearch.setWidth(side);
    }
  }

  function dressMember(wrapper) {
    var inner = wrapper.getMembers ? wrapper.getMembers()[0] : null;
    var role;

    // dressMember runs again for every later addMembers, so already dressed wrappers are left
    // alone: keepMarked and trackAlerts both wrap a method, and wrapping one twice would double
    // every call it makes.
    if (!inner || wrapper.etskinMarker) {
      return;
    }

    if (dropped(inner)) {
      wrapper.hide();
      return;
    }

    if (isSearch(inner)) {
      keepMarked(wrapper, MARKER + 'search');
      wrapper.setOverflow('hidden');
      searchWrapper = wrapper;
      return;
    }

    if (!isIcon(inner)) {
      wrapper.setHeight(BUTTON);
      keepMarked(wrapper, MARKER + 'item ' + MARKER + 'wide');
      return;
    }

    resize(wrapper, BUTTON, BUTTON);
    resize(inner, BUTTON, BUTTON);
    // Stock leaves these overflowing - the profile button still carries the menu arrow the
    // stylesheet hides - and a ToolStrip measures its members by what they draw, not by what they
    // were set to, so without this the tray would space them by their old widths.
    wrapper.setOverflow('hidden');

    role = ROLES[inner.getClassName()];
    if (role === 'alert') {
      keepMarked(wrapper, MARKER + 'item ' + MARKER + 'alert');
      trackAlerts(wrapper, inner);
    } else if (role === 'profile') {
      keepMarked(wrapper, MARKER + 'item ' + MARKER + 'profile');
      makeAvatar(inner);
    } else if (role) {
      keepMarked(wrapper, MARKER + 'item ' + MARKER + role);
    } else {
      keepMarked(wrapper, MARKER + 'item');
    }
  }

  /*
   * Turns a member the tray dressed as a wide one into a round icon chip, and says whether it is
   * currently on.
   *
   * dressMember cannot decide this for itself. It has no way to tell a module's text button whose
   * word is the control from one whose glyph the stylesheet knows, so it leaves an unknown member
   * its width rather than cut a label in half. A script that does know the button says so here -
   * the Copilot dock does, for Copilot's own button, because it is only ever loaded when Copilot is
   * installed - and the button joins the row as one of the chips instead of sitting in it as a
   * word. The title becomes the tooltip, the way the bell's count does, since what replaces it is
   * a mask keyed on the role - and the module that knows the button ships that mask with it.
   *
   * Repeating the call is how the on state is set, so it is written with remark rather than
   * keepMarked once the wrapper has been marked: wrapping setStyleName twice would double every
   * call it makes.
   */
  function chip(wrapper, role, active) {
    var inner = wrapper && wrapper.getMembers ? wrapper.getMembers()[0] : null;
    var marker;

    if (!inner) {
      return false;
    }
    // 'chip' says the member came through this API from another module, which is what lets the
    // stylesheet keep such chips round without naming any module's role.
    marker = MARKER + 'item ' + MARKER + 'chip ' + MARKER + role + (active ? ' ' + MARKER + role + '-on' : '');
    if (wrapper.etskinMarker) {
      remark(wrapper, marker);
    } else {
      keepMarked(wrapper, marker);
    }
    if (inner.title && inner.setPrompt) {
      inner.setPrompt(String(inner.title));
    }
    if (inner.setTitle) {
      inner.setTitle('');
    }
    resize(wrapper, BUTTON, BUTTON);
    resize(inner, BUTTON, BUTTON);
    wrapper.setOverflow('hidden');
    if (OB.NavBar.reflow) {
      OB.NavBar.reflow();
    }
    return true;
  }

  /*
   * Puts a member at the head of the row. Identity and the way out of the application are the two
   * chips that belong hard against the right edge, where every application this one sits beside
   * keeps them, and a module that adds a chip lands after them because it was added last.
   */
  function moveFirst(wrapper) {
    var members = OB.NavBar.getMembers() || [];
    var i;

    for (i = 0; i < members.length; i++) {
      if (members[i] === wrapper) {
        if (i > 0 && OB.NavBar.reorderMember) {
          OB.NavBar.reorderMember(i, 0);
        }
        return true;
      }
    }
    return false;
  }

  /*
   * Run after the members have drawn rather than as they are dressed, because a component's width
   * is whatever it measured itself at and it has not measured anything yet at the moment it joins
   * the bar.
   */
  function pruneSlivers() {
    var members = OB.NavBar.getMembers() || [];
    var i, member;

    for (i = 0; i < members.length; i++) {
      member = members[i];
      if (!member.etskinMarker || !member.isVisible || !member.isVisible()) {
        continue;
      }
      if (member.getVisibleWidth && member.getVisibleWidth() < USABLE) {
        member.hide();
      }
    }
  }

  function dressButtons() {
    var members = OB.NavBar.getMembers() || [];
    var i;

    for (i = 0; i < members.length; i++) {
      dressMember(members[i]);
    }
    if (typeof setTimeout === 'function') {
      setTimeout(pruneSlivers, 600);
    }
  }

  /*
   * The navigation bar is not finished being built when OB.Layout.initialize returns. The debug
   * tools module, for one, waits for the tab set to exist and only then calls createMembers, so a
   * tray dressed once would end with one undressed member in it.
   */
  function watchAdditions() {
    var strip = OB.NavBar;
    var original = strip.addMembers;

    strip.addMembers = function () {
      var result = original.apply(this, arguments);
      try {
        dressButtons();
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Etendo Modern Skin could not dress a new navigation bar component', e);
        }
      }
      return result;
    };
  }

  /*
   * The tray's margins are deliberately not set here. A ToolStrip carries paddingAsLayoutMargin, so
   * it takes its inset from the padding on its style name - and a layoutTopMargin written in
   * JavaScript overrides that inset without removing the padding the element still reserves, which
   * is how the strip ended up 10px taller than the height it was given. The padding lives in the
   * stylesheet, next to the pill it draws, and TRAY_PAD is this file's copy of that number.
   */
  function dressTray() {
    var strip = OB.NavBar;

    strip.membersMargin = TRAY_GAP;
    strip.setHeight(BUTTON + 2 * TRAY_PAD);
  }

  // ------------------------------------------------------------------ order

  /*
   * [left spacer, navbar, middle spacer, logos] becomes [logos, spacers, navbar]. The members are
   * the canvases core created, moved rather than rebuilt, so OB.TopLayout.CompanyImageLogo and
   * OB.TopLayout.OpenbravoLogo stay the objects core handed out and anything holding a reference
   * to them still works.
   */
  function reorder() {
    var top = OB.TopLayout;
    var members = top.getMembers() || [];
    var logos = OB.TopLayout.CompanyImageLogo
      ? OB.TopLayout.CompanyImageLogo.getParentCanvas()
      : null;
    var ordered = [];
    var i, member;

    if (!logos) {
      return;
    }

    ordered.push(logos);
    ordered.push(makeTitle());
    for (i = 0; i < members.length; i++) {
      member = members[i];
      if (member !== logos && member !== OB.NavBar && member !== titleCanvas &&
          member !== searchWrapper && member !== top.etskinEdge &&
          member !== top.etskinBeforeSearch && member !== top.etskinAfterSearch) {
        ordered.push(member);
      }
    }
    /*
     * The search field leaves the tray for the middle of the bar. The wrapper is moved, not rebuilt:
     * OBQuickRun positions its flyout from the wrapper it is in at the moment it opens, and marks
     * that same wrapper while the flyout is open, so both follow it.
     */
    if (searchWrapper) {
      if (OB.NavBar.getMembers().indexOf(searchWrapper) !== -1) {
        OB.NavBar.removeMember(searchWrapper);
      }
      searchLabel(searchWrapper.getMembers()[0]);
      if (!top.etskinAfterSearch) {
        top.etskinBeforeSearch = isc.LayoutSpacer.create({ width: 8, height: 1 });
        top.etskinAfterSearch = isc.LayoutSpacer.create({ width: 8, height: 1 });
      }
      ordered.push(top.etskinBeforeSearch);
      ordered.push(searchWrapper);
      ordered.push(top.etskinAfterSearch);
    }
    ordered.push(OB.NavBar);

    /*
     * layoutRightMargin on OB.TopLayout is ignored once the layout has been drawn - the stock bar
     * was built with the tray hard against the right edge and never reflows its margins - so the
     * gutter is a member instead. A spacer is a member like any other and lands where it is put.
     */
    if (!top.etskinEdge) {
      top.etskinEdge = isc.LayoutSpacer.create({ width: 8, height: 1 });
    }
    ordered.push(top.etskinEdge);

    // The logos container was built to hug the right edge; on the left it is the brand. With the
    // side navigation on, it is exactly as wide, so the title starts over the content.
    if (logos.setAlign) {
      logos.setAlign('left');
    }
    logos.layoutLeftMargin = 0;
    logos.layoutRightMargin = 12;
    if (OB.ETSkin.nav && logos.setWidth) {
      logos.setWidth(BRAND_WIDTH);
    }
    // As tall as the tray: the logo's line box measured a pixel more and made the bar 63px.
    if (logos.setHeight) {
      logos.setOverflow('hidden');
      logos.setHeight(BUTTON + 2 * TRAY_PAD);
    }
    top.etskinBrand = logos;

    top.setMembers(ordered);
  }

  /*
   * Stock is 4px above the row and 10 below it, which with a 50px tray comes to a 65px bar. An even 8
   * above and below a 46px tray is 62, Etendo GO's bar, and the same height as the head of the side
   * navigation under the brand.
   *
   * Both halves are needed. The four properties say what the margins are; setLayoutMargin is what
   * makes the layout read them again, because a Layout resolves its margins once, while it is
   * measuring itself, and a property written on a bar that is already drawn changes the object and
   * not the screen. An earlier version of this function only assigned, and the bar stayed at 65
   * through a reflow.
   */
  function dressBar() {
    var top = OB.TopLayout;

    top.layoutTopMargin = GAP;
    top.layoutBottomMargin = GAP;
    top.layoutLeftMargin = 0;
    top.layoutRightMargin = 8;
    if (top.setLayoutMargin) {
      top.setLayoutMargin(GAP);
    }
    if (top.setDefaultLayoutAlign) {
      top.setDefaultLayoutAlign('center');
    }
  }

  // ---------------------------------------------------------------- install

  function install() {
    dressBar();
    dressTray();
    dressButtons();
    watchAdditions();
    reorder();
    OB.TopLayout.reflow();
    fit();
    renderTitle();
    watchTabs();
    if (isc.Page && isc.Page.setEvent) {
      isc.Page.setEvent('resize', function () {
        // After the layout has taken the new width, which it does on the same event.
        setTimeout(fit, 0);
      });
    }

    OB.ETSkin.topBar = { tray: OB.NavBar, chip: chip, first: moveFirst };
  }

  // ------------------------------------------------------------------ main

  try {
    if (typeof OB !== 'undefined' && OB && OB.Layout && OB.Layout.initialize) {
      var originalInitialize = OB.Layout.initialize;
      OB.Layout.initialize = function () {
        var result = originalInitialize.apply(this, arguments);
        try {
          if (wanted()) {
            install();
          }
        } catch (e) {
          // A tray that fails to build must not cost the user the navigation bar: every control is
          // still there, in its stock place, because nothing here removes anything.
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Etendo Modern Skin could not restyle the navigation bar', e);
          }
        }
        return result;
      };
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Etendo Modern Skin navigation bar styling is unavailable', e);
    }
  }
})();
