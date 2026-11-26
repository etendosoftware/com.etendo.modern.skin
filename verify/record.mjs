/*
 *************************************************************************
 * Copyright (C) 2026 Futit Services S.L.
 * Licensed under the Openbravo Public License version 1.1.
 * You may obtain a copy of the License at
 * http://www.openbravo.com/legal/license.html
 ************************************************************************
 */

/*
 * Records what check-dom.mjs asserts on. It logs in to a running instance, puts the application in
 * each state with drive.js, measures it with capture.js and writes recordings/<prefix>-<screen>.json
 * and shots/<prefix>-<screen>.png. The login page is a different document and is recorded from a
 * fresh, logged-out browser.
 *
 * Usage:
 *   node verify/record.mjs --playwright <path to playwright> [--base http://localhost:8080/etendo]
 *     [--prefix after] [--screens grid,form,new,rail,login]
 * Credentials come from ETSKIN_USER / ETSKIN_PASSWORD, and default to admin / admin.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = arg('base', 'http://localhost:8080/etendo').replace(/\/$/, '');
const PREFIX = arg('prefix', 'after');
const SCREENS = arg('screens', 'grid,form,new,rail,login').split(',');
const USER = process.env.ETSKIN_USER || 'admin';
const PASSWORD = process.env.ETSKIN_PASSWORD || 'admin';

const { chromium } = await import(arg('playwright', 'playwright'));
const drive = readFileSync(join(HERE, 'drive.js'), 'utf8');
const capture = readFileSync(join(HERE, 'capture.js'), 'utf8');

async function record(page, screen) {
  await page.addScriptTag({ content: capture });
  const measured = await page.evaluate((s) => window.etskinCapture(s), screen);
  writeFileSync(join(HERE, 'recordings', `${PREFIX}-${screen}.json`), JSON.stringify(measured, null, 2) + '\n');
  await page.screenshot({ path: join(HERE, 'shots', `${PREFIX}-${screen}.png`) });
  console.log(`[record] ${screen}`);
}

const browser = await chromium.launch({ channel: arg('channel', undefined) });
const viewport = { width: 1440, height: 900 };
try {
  const app = SCREENS.filter((s) => s !== 'login');
  if (app.length) {
    const page = await (await browser.newContext({ viewport })).newPage();
    await page.goto(`${BASE}/security/Login`);
    await page.fill('#user', USER);
    await page.fill('#password', PASSWORD);
    await page.click('#buttonOK');
    await page.waitForFunction('!!window.OB && !!OB.MainView', null, { timeout: 120000 });
    // The bookmark only differs from the page in its hash, so the app is left first to force a load.
    await page.addScriptTag({ content: drive });
    const url = new URL(await page.evaluate('window.etskinDriveUrl'), BASE).href;
    await page.goto('about:blank');
    await page.goto(url);
    await page.waitForFunction('!!window.OB && !!OB.MainView', null, { timeout: 120000 });
    await page.addScriptTag({ content: drive });
    for (const screen of app) {
      await page.evaluate((s) => window.etskinDrive(s), screen);
      await record(page, screen);
    }
  }
  if (SCREENS.includes('login')) {
    const page = await (await browser.newContext({ viewport })).newPage();
    await page.goto(`${BASE}/security/Login`);
    await page.waitForSelector('#user');
    await page.waitForTimeout(1500);
    await record(page, 'login');
  }
} finally {
  await browser.close();
}
