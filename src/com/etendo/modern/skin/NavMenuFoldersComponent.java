/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

package com.etendo.modern.skin;

import java.util.List;

import javax.inject.Inject;

import org.openbravo.client.application.MenuManager;
import org.openbravo.client.application.MenuManager.MenuOption;
import org.openbravo.client.kernel.BaseComponent;
import org.openbravo.model.ad.utility.TreeNode;

/**
 * Publishes the menu ids of the session's menu, for the side navigation to group it by.
 * <p>
 * {@code OB.Application.menu}, which core's application-menu template emits, does not carry them: a
 * folder has its translated title and its children and nothing else, and the {@code id} of an entry
 * is the id of what it opens, not of the menu entry. Grouping the panel by title would break in every
 * other language and whenever a client renames a folder, so this emits the same tree once more -
 * from the same {@code MenuManager} the template reads, in the same order - with each folder as
 * {@code ['<AD_MENU_ID>', [children]]} and each entry as {@code '<AD_MENU_ID>'}.
 * {@code etendo-skin-nav.js} walks the two side by side, and stands down if their shapes disagree.
 * <p>
 * The menu is per session and per role, so the response must never be answered from a cache:
 * {@link #getETag()} is different on every request.
 */
public class NavMenuFoldersComponent extends BaseComponent {

  public static final String COMPONENT_ID = "NavMenuFolders";

  @Inject
  private MenuManager menuManager;

  @Override
  public String generate() {
    final StringBuilder out = new StringBuilder("if (window.OB) {\n  OB.ETSkinMenuFolders = ");
    final MenuOption root = menuManager.getMenu();
    append(out, root == null ? null : root.getChildren());
    out.append(";\n}\n");
    return out.toString();
  }

  private void append(StringBuilder out, List<MenuOption> options) {
    out.append('[');
    if (options != null) {
      for (int i = 0; i < options.size(); i++) {
        final MenuOption option = options.get(i);
        final List<MenuOption> children = option.getChildren();
        if (i > 0) {
          out.append(',');
        }
        if (children != null && !children.isEmpty()) {
          out.append("['").append(menuId(option)).append("',");
          append(out, children);
          out.append(']');
        } else {
          out.append('\'').append(menuId(option)).append('\'');
        }
      }
    }
    out.append(']');
  }

  // Menu ids are 32 hex characters or a short number; anything else is dropped rather than quoted.
  private String menuId(MenuOption option) {
    final TreeNode node = option.getTreeNode();
    final String id = node != null ? node.getNode() : option.getDbId();
    return id == null ? "" : id.replaceAll("[^0-9A-Za-z]", "");
  }

  @Override
  public Object getData() {
    return this;
  }

  @Override
  public String getETag() {
    return COMPONENT_ID + "_" + System.nanoTime();
  }
}
