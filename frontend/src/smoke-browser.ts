import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const appUrl = process.env.DR_WEB_BASE_URL ?? 'http://localhost:4200';
const apiBaseUrl = (process.env.DR_API_BASE_URL ?? 'http://localhost:4100').replace(/\/+$/, '');
const defaultChromePath =
  process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : undefined;
const chromePath = process.env.CHROME_PATH || defaultChromePath;
const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `browser-${unique}@example.test`;
const password = 'browser-password-01';
const characterName = `Browser${unique.slice(-5)}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Browser smoke API request failed ${response.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    ...(chromePath ? { executablePath: chromePath } : {}),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(appUrl, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Switch to register' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Display name (optional)').fill('Browser Smoke');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText('Account created. Switch to login to continue.').waitFor();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('heading', { name: 'DragonRealms Next Gen' }).waitFor();
    await page.getByText('Use verb for grouped commands').waitFor();
    await page.getByText('help scan').waitFor();
    await page.getByText('target <name>').waitFor();
    await page.getByText('Scripts are reusable command macros').waitFor();
    await page.getByRole('button', { name: /load Crossing Guild Tour/ }).click();
    await page.getByLabel('Script name').fill('Browser Guild Tour');
    await page.getByRole('button', { name: 'Save Script' }).click();
    await page.locator('.terminal-pane .log').getByText('Saved script "Browser Guild Tour"').waitFor();
    await page.locator('.script-item').getByText('Browser Guild Tour (16 cmds)').waitFor();

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(characterName);
    await page.getByText('Creation uses DragonRealms modern fixed racial starting stats.').waitFor();
    await page.getByText('Starting stats:').waitFor();
    await page.getByRole('button', { name: 'Create Character' }).click();
    await page.getByText(new RegExp(`Created ${characterName}`)).waitFor();
    await page.locator('.topbar-stats').getByText('Modern fixed racial stats').waitFor();
    await page.getByText('Room Affordances').waitFor();
    await page.getByText('Structured survey summary from room state').waitFor();
    await page.getByText('Item Details').waitFor();
    await page.getByText('training sword | weapon | 2 trias').waitFor();

    const login = await apiRequest<{ accessToken: string }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const characterList = await apiRequest<{ characters: Array<{ id: string; name: string }> }>('/v1/characters', {
      headers: { authorization: `Bearer ${login.accessToken}` },
    });
    const createdCharacter = characterList.characters.find((entry) => entry.name === characterName);
    assert(createdCharacter, 'Expected browser-created character in API character list.');
    await apiRequest(`/v1/test/characters/${createdCharacter.id}/state`, {
      method: 'POST',
      headers: { authorization: `Bearer ${login.accessToken}` },
      body: JSON.stringify({ inventoryAppend: ['damaged-itm-sting-arrow'] }),
    });

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('inventory');
    await page.keyboard.press('Enter');
    const damagedAmmoDetail = page.locator('.item-detail').filter({ hasText: 'damaged-itm-sting-arrow | salvage | 1 trias' });
    await damagedAmmoDetail.getByText('damaged practice arrow', { exact: true }).waitFor();
    await damagedAmmoDetail.getByText('damaged-itm-sting-arrow | salvage | 1 trias').waitFor();
    await damagedAmmoDetail.getByText('broken ranged ammunition').waitFor();
    await page.getByText('Selling requires a local shop. Travel to a shop room before selling carried items.').waitFor();
    await page
      .locator('.equip li')
      .filter({ hasText: 'damaged practice arrow' })
      .getByRole('button', { name: 'sell' })
      .waitFor({ state: 'visible' });

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('east');
    await page.keyboard.press('Enter');
    await page.getByText(/You go east to Marksman Way/).waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 1200');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 1200ms/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('north');
    await page.keyboard.press('Enter');
    await page.getByText(/You go north to Marksman Sheds/).waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 1200');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 1200ms/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('shop buy itm-sting-arrow');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You buy practice arrow/).waitFor();
    await page
      .locator('.ammo-pouch-list li')
      .filter({ hasText: 'itm-sting-arrow x5' })
      .getByText('Marksman Supply Stand buys practice arrow from your ammo pouch for about 1 trias each.')
      .waitFor();
    await page
      .locator('.ammo-pouch-list li')
      .filter({ hasText: 'itm-sting-arrow x5' })
      .getByText('bundle 5 | resale estimate 1 trias each')
      .waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await page.locator('.ammo-pouch-list li').filter({ hasText: 'itm-sting-arrow x5' }).getByRole('button', { name: 'sell one' }).click();
    await page.locator('.terminal-pane .log').getByText(/You sell one practice arrow from your ammo pouch/).waitFor();
    await page
      .locator('.ammo-pouch-list li')
      .filter({ hasText: 'itm-sting-arrow x4' })
      .getByText('Marksman Supply Stand buys practice arrow from your ammo pouch for about 1 trias each.')
      .waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await page
      .locator('.equip li')
      .filter({ hasText: 'damaged practice arrow' })
      .getByText('Marksman Supply Stand buys matching salvage for about 1 trias.')
      .waitFor();
    await page.locator('.equip li').filter({ hasText: 'damaged practice arrow' }).getByRole('button', { name: 'sell' }).click();
    await page.locator('.terminal-pane .log').getByText('You sell damaged practice arrow').waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('south');
    await page.keyboard.press('Enter');
    await page.getByText(/You go south to Marksman Way/).waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('west');
    await page.keyboard.press('Enter');
    await page.getByText(/You go west to Crossing Town Green/).waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();
    await page
      .locator('.ammo-pouch-list li')
      .filter({ hasText: 'itm-sting-arrow x4' })
      .getByText('Selling ammo requires a local shop.')
      .waitFor();
    const ammoSellButtonDisabledOutsideShop = await page
      .locator('.ammo-pouch-list li')
      .filter({ hasText: 'itm-sting-arrow x4' })
      .getByRole('button', { name: 'sell one' })
      .isDisabled();
    assert(ammoSellButtonDisabledOutsideShop, 'Expected ammo pouch sell button to be disabled outside shops.');

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('look');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText('A broad square with the fountain').waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('appraise training sword');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText('Item: training sword').waitFor();
    await page.locator('.terminal-pane .log').getByText('Category: weapon. Source: starter.').waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wear leather backpack');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText('You wear leather backpack on your back slot.').waitFor();
    await page.locator('.equip').getByRole('paragraph').filter({ hasText: /^leather backpack$/ }).waitFor();
    await page.locator('.equip').getByText('back: leather backpack').waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 1200');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 1200ms/).last().waitFor();

    await page.getByRole('button', { name: 'range', exact: true }).click();
    await page.getByText('You are not engaged with a target.').waitFor();

    await page.getByRole('button', { name: 'verb', exact: true }).click();
    await page.locator('.terminal-pane .log').getByText('Verb groups:').waitFor();
    await page.locator('.terminal-pane .log').getByText('Targets: scan, target, target <name>, appraise <target>.').waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').focus();
    await page.keyboard.press('Numpad6');
    await page.locator('.terminal-pane .log').getByText(/You go east to Marksman Way/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').focus();
    await page.keyboard.press('Numpad4');
    await page.locator('.terminal-pane .log').getByText(/You go west to Crossing Town Green/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('look');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText('A broad square with the fountain').last().waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await apiRequest(`/v1/test/characters/${createdCharacter.id}/state`, {
      method: 'POST',
      headers: { authorization: `Bearer ${login.accessToken}` },
      body: JSON.stringify({ roomId: 'crossing-RV02-002' }),
    });
    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('look');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText('Scrubland edges and low brush.').last().waitFor();
    await page.getByText('Forage available').waitFor();
    await page.getByText(/difficulty 1: field herb bundle/).waitFor();
    await page.locator('.affordance-row').filter({ hasText: 'Targets visible' }).getByText('forage wolf-cub').waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('wait 900');
    await page.keyboard.press('Enter');
    await page.locator('.terminal-pane .log').getByText(/You wait for 900ms/).last().waitFor();

    await page.getByRole('button', { name: 'survey', exact: true }).click();
    await page.locator('.terminal-pane .log').getByText('Surveying Brushline Forage Fork:').waitFor();
    await page.locator('.terminal-pane .log').getByText('Forage: difficulty').waitFor();
    await page.locator('.terminal-pane .log').getByText('Targets: forage wolf-cub.').waitFor();

    await page.locator('.panel').filter({ hasText: 'Controls' }).getByRole('button', { name: 'scan', exact: true }).click();
    await page.locator('.terminal-pane .log').getByText(/ - forage wolf-cub \(/).last().waitFor();
    await page.locator('.terminal-pane .log').getByText('Vitality estimates how long a target can stay in the fight').waitFor();
    await page.getByText('Visible Targets').waitFor();
    await page.getByText('Vitality estimates staying power').waitFor();
    await page.getByText('Vitality 10 · Aggression 55').waitFor();
    await page.locator('.target-actions').filter({ hasText: 'forage wolf-cub' }).getByRole('button', { name: 'details' }).click();
    await page.locator('.terminal-pane .log').getByText('Suggested next verb: advance forage wolf-cub.').waitFor();
    await page.locator('.target-actions').filter({ hasText: 'forage wolf-cub' }).getByRole('button', { name: 'advance' }).click();
    await page.locator('.terminal-pane .log').getByText(/You begin advancing on forage wolf-cub/).waitFor();

    const content = await page.content();
    for (const expected of [
      characterName,
      'Controls',
      'Directional movement controls',
      'Hands',
      'Inventory',
      'Room',
      'Exits',
    ]) {
      assert(content.includes(expected), `Expected browser UI to include ${expected}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          suite: 'frontend:smoke-browser',
          account: email,
          browser: chromePath ? 'system-chrome' : 'playwright-chromium',
          commandCount: 29,
          targetDetailsClicked: true,
          verbDiscoveryClicked: true,
          surveyClicked: true,
          roomAffordancePanelVisible: true,
          itemDetailsVisible: true,
          damagedAmmoItemDetailsVisible: true,
          damagedAmmoSoldFromInventory: true,
          disabledSellHintVisible: true,
          shopAwareSellHintVisible: true,
          ammoPouchSellClicked: true,
          ammoPouchRemainingVisible: true,
          ammoPouchDisabledHintVisible: true,
          ammoPouchMetadataVisible: true,
          sharedEconomyHintVisible: true,
          commandDiscoveryVisible: true,
          scriptDiscoveryVisible: true,
          scriptPresetSaved: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
