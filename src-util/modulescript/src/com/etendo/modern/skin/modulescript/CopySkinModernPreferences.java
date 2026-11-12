/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

package com.etendo.modern.skin.modulescript;

import java.sql.PreparedStatement;

import org.openbravo.database.ConnectionProvider;
import org.openbravo.modulescript.ModuleScript;
import org.openbravo.modulescript.ModuleScriptExecutionLimits;
import org.openbravo.modulescript.OpenbravoVersion;

/**
 * Carries the preferences set for {@code com.etendoerp.skin.modern} over to this module's names:
 * every {@code ETSKIN_Enabled}, {@code ETSKIN_Theme} and {@code ETSKIN_Navigation} gets an
 * {@code ETMSK_*} copy with the same value and the same visibility.
 * <p>
 * The values are copied, not renamed, so {@code com.etendoerp.skin.modern} keeps its own rows if it
 * is still installed. Skipped: that module's own system-level seeds (this module ships its own
 * defaults), rows inherited from a template role (role inheritance recreates them from the copied
 * template row), and any visibility that already has an {@code ETMSK_*} value.
 * <p>
 * Runs on install and on an update from a version before 1.1.0, the one that introduced the
 * {@code ETMSK_*} names; after that the two sets of preferences are independent.
 */
public class CopySkinModernPreferences extends ModuleScript {

  private static final String SHELL_MODULE_ID = "82257866FAE7421381C9A5FC45C2D76D";
  private static final String SKIN_MODERN_MODULE_ID = "10C160A6B0DE43C3B2CF20FF477AB15B";

  private static final String COPY = "INSERT INTO ad_preference (ad_preference_id, ad_client_id,"
      + " ad_org_id, isactive, createdby, updatedby, property, ispropertylist, value,"
      + " visibleat_client_id, visibleat_org_id, visibleat_role_id, ad_user_id, ad_window_id,"
      + " selected)"
      + " SELECT get_uuid(), p.ad_client_id, p.ad_org_id, p.isactive, '0', '0',"
      + " 'ETMSK_' || substr(p.property, 8), 'Y', p.value, p.visibleat_client_id,"
      + " p.visibleat_org_id, p.visibleat_role_id, p.ad_user_id, p.ad_window_id, p.selected"
      + " FROM ad_preference p"
      + " WHERE p.ispropertylist = 'Y'"
      + " AND p.property IN ('ETSKIN_Enabled', 'ETSKIN_Theme', 'ETSKIN_Navigation')"
      + " AND COALESCE(p.ad_module_id, '-') <> ?"
      + " AND p.inherited_from IS NULL"
      + " AND NOT EXISTS (SELECT 1 FROM ad_preference e"
      + "   WHERE e.ispropertylist = 'Y' AND e.property = 'ETMSK_' || substr(p.property, 8)"
      + "   AND e.ad_client_id = p.ad_client_id AND e.ad_org_id = p.ad_org_id"
      + "   AND COALESCE(e.visibleat_client_id, '-') = COALESCE(p.visibleat_client_id, '-')"
      + "   AND COALESCE(e.visibleat_org_id, '-') = COALESCE(p.visibleat_org_id, '-')"
      + "   AND COALESCE(e.visibleat_role_id, '-') = COALESCE(p.visibleat_role_id, '-')"
      + "   AND COALESCE(e.ad_user_id, '-') = COALESCE(p.ad_user_id, '-')"
      + "   AND COALESCE(e.ad_window_id, '-') = COALESCE(p.ad_window_id, '-'))";

  @Override
  public void execute() {
    try {
      ConnectionProvider cp = getConnectionProvider();
      PreparedStatement ps = cp.getPreparedStatement(COPY);
      try {
        ps.setString(1, SKIN_MODERN_MODULE_ID);
        ps.executeUpdate();
      } finally {
        cp.releasePreparedStatement(ps);
      }
    } catch (Exception e) {
      handleError(e);
    }
  }

  @Override
  protected ModuleScriptExecutionLimits getModuleScriptExecutionLimits() {
    return new ModuleScriptExecutionLimits(SHELL_MODULE_ID, null, new OpenbravoVersion(1, 1, 0));
  }
}
