/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

package com.etendo.modern.skin;

import javax.enterprise.context.ApplicationScoped;

import org.openbravo.erpCommon.security.SignInProvider;

/**
 * Puts the login stylesheet on the login page without touching core.
 * <p>
 * The login page is not served by the kernel: {@code org.openbravo.erpCommon.security.Login} renders
 * {@code Login.html} through XmlEngine, and that page loads two stylesheets of its own and none of
 * the application bundles. So {@code SkinComponentProvider}, which registers everything else this
 * module ships, has no way to reach it, and the only documented seam into the page is this one -
 * {@code Login} injects {@code Instance<SignInProvider>} and writes every provider's HTML into the
 * {@code sign-in} parameter, which {@code Login.xml} declares and {@code Login.html} anchors on a
 * {@code <DIV id="sign-in">}. Nothing is escaped on the way, so the markup arrives as written.
 * <p>
 * The seam is named for alternative sign-in buttons, which is what it was built for, and a
 * stylesheet is not one. It is used here because the alternative is editing a core template, which
 * a core refresh silently reverts. A link element is the
 * smallest thing that can be put through it: no script, no data, no request of its own.
 * <p>
 * Two consequences follow from where the anchor sits, and the stylesheet handles both. The link
 * lands in the body rather than the head, after the page's inline {@code <style>}, so it wins on
 * order rather than on specificity - and it arrives late enough that the stock page paints first.
 * And the container draws a divider once it is no longer empty, for the sign-in options it expects;
 * the sheet suppresses that while this link is the only thing in it, and lets it come back the day
 * a real provider joins.
 * <p>
 * Nothing here is configurable. The page runs before authentication, so there is no client,
 * organization, role or user to resolve {@code ETSKIN_Enabled} or {@code ETSKIN_Theme} against, and
 * asking would mean a database read on an anonymous request. The login theme is therefore global
 * and fixed, and the stylesheet says so at the top.
 * <p>
 * To withdraw the experiment: delete this class. The page returns to stock and nothing else in the
 * module refers to it.
 */
@ApplicationScoped
public class LoginSignInProvider implements SignInProvider {

  /**
   * Relative to the login servlet at {@code /security/Login}, the same form the page's own two
   * stylesheet links already use.
   */
  static final String STYLESHEET = "../web/com.etendo.modern.skin/css/etendo-skin-login.css";

  private static final String HTML = "<link rel=\"stylesheet\" type=\"text/css\" href=\"" + STYLESHEET
      + "\">";

  /**
   * A constant. It takes no argument, reads no preference, opens no session and touches no request
   * state, so there is nothing here for a caller to influence.
   */
  @Override
  public String getLoginPageSignInHTMLCode() {
    return HTML;
  }
}
