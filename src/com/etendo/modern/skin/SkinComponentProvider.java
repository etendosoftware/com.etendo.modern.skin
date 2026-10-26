/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

package com.etendo.modern.skin;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.enterprise.context.ApplicationScoped;

import org.openbravo.client.kernel.BaseComponentProvider;
import org.openbravo.client.kernel.Component;
import org.openbravo.client.kernel.ComponentProvider;

/**
 * Registers the modern skin's shell with the kernel resource pipeline: the stylesheet, the theme
 * runtime, and the five scripts that restyle the navigation, the top bar, the toolbar, forms and
 * grids.
 * <p>
 * Only the shell. The application screens that used to ship with the skin - a workspace dashboard,
 * a point of sale, a sales order board and a Copilot dock - belong to modules of their own and
 * register their resources there. They build on {@code OB.ETSkin}, which the runtime below
 * publishes, so a module that carries one of them should depend on this one: the kernel orders
 * global resources by module dependency, and each of those scripts stands down without it.
 * <p>
 * Resources are registered unconditionally on purpose. The generated bundles are cached globally
 * under a key built from the application name and the skin version only (see
 * {@code StyleSheetResourceComponent#getAppNameKey}), so making registration depend on a preference
 * would freeze the bundle with whatever the first requesting user happened to have configured.
 * Everything client, role or user specific is therefore decided in the browser by
 * {@code etendo-skin.js}, which reads {@code OB.Properties}.
 */
@ApplicationScoped
@ComponentProvider.Qualifier(SkinComponentProvider.COMPONENT_TYPE)
public class SkinComponentProvider extends BaseComponentProvider {

  public static final String COMPONENT_TYPE = "com.etendo.modern.skin_Resources";

  private static final String WEB_PATH = "web/com.etendo.modern.skin/";

  @Override
  public Component getComponent(String componentId, Map<String, Object> parameters) {
    if (NavMenuFoldersComponent.COMPONENT_ID.equals(componentId)) {
      final NavMenuFoldersComponent component = getComponent(NavMenuFoldersComponent.class);
      component.setId(componentId);
      component.setParameters(parameters);
      return component;
    }
    throw new IllegalArgumentException("Component id " + componentId + " not supported.");
  }

  @Override
  public List<ComponentResource> getGlobalComponentResources() {
    final List<ComponentResource> globalResources = new ArrayList<ComponentResource>();

    globalResources.add(createStyleSheetResource(WEB_PATH + "css/etendo-skin.css", false));
    globalResources.add(createStaticResource(WEB_PATH + "js/etendo-skin.js", false));
    // Everything below must come after etendo-skin.js: each script stands down unless that one has
    // published OB.ETSkin.
    // The menu folder ids the side navigation groups by. Per session, so a dynamic resource; see
    // NavMenuFoldersComponent.
    globalResources.add(createDynamicResource("org.openbravo.client.kernel/" + COMPONENT_TYPE + "/"
        + NavMenuFoldersComponent.COMPONENT_ID));
    globalResources.add(createStaticResource(WEB_PATH + "js/etendo-skin-nav.js", false));
    globalResources.add(createStaticResource(WEB_PATH + "js/etendo-skin-topbar.js", false));
    globalResources.add(createStaticResource(WEB_PATH + "js/etendo-skin-toolbar.js", false));
    globalResources.add(createStaticResource(WEB_PATH + "js/etendo-skin-form.js", false));
    globalResources.add(createStaticResource(WEB_PATH + "js/etendo-skin-grid.js", false));

    return globalResources;
  }
}
