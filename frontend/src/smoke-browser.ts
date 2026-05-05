import { chromium } from 'playwright-core';

const appUrl = process.env.DR_WEB_BASE_URL ?? 'http://localhost:4200';
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `browser-${unique}@example.test`;
const password = 'browser-password-01';
const characterName = `Browser${unique.slice(-5)}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: chromePath,
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

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(characterName);
    await page.getByRole('button', { name: 'Create Character' }).click();
    await page.getByText(new RegExp(`Created ${characterName}`)).waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').fill('look');
    await page.keyboard.press('Enter');
    await page.getByText('A broad square with the fountain').waitFor();

    await page.getByRole('button', { name: 'range', exact: true }).click();
    await page.getByText('You are not engaged with a target.').waitFor();

    await page.getByPlaceholder('look | exits | score | range | advance | circle | jab | bash | retreat').focus();
    await page.keyboard.press('Numpad6');
    await page.getByText(/You go east/).waitFor();

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

    console.log(JSON.stringify({ ok: true, suite: 'frontend:smoke-browser', account: email }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
