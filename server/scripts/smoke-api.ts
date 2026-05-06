type JsonObject = Record<string, unknown>;

type SmokeSuite = 'all' | 'identity' | 'scripts' | 'progression' | 'economy' | 'targets' | 'combat';

interface AuthTokens {
  accessToken: string;
}

interface RaceSummary {
  id: string;
  name: string;
}

interface CharacterSummary {
  id: string;
  name: string;
  race: string;
  roomId: string;
  circle: number;
  inventory: string[];
  health: {
    current: number;
    max: number;
  };
  combat?: {
    range: 'missile' | 'pole' | 'melee';
    advantage: number;
  };
}

interface CommandResult {
  events: string[];
  character: CharacterSummary;
  targets: RoomTarget[];
}

interface RoomTarget {
  id: string;
  name: string;
  vitality: number;
  aggression: number;
}

interface GuildSummary {
  id: string;
  name: string;
  roomId: string;
}

interface ShopRoomSummary {
  roomId: string;
  title: string;
  shop: {
    code: string;
    name: string;
    items: Array<{
      code: string;
      name: string;
    }>;
  };
}

interface ScriptRecord {
  id: string;
}

interface SmokeContext {
  accessToken: string;
  account: string;
  races: RaceSummary[];
  character: CharacterSummary;
  summary: Record<string, unknown>;
}

const suites: SmokeSuite[] = ['all', 'identity', 'scripts', 'progression', 'economy', 'targets', 'combat'];
const requestedSuite = (process.argv[2] ?? 'all') as SmokeSuite;
const baseUrl = (process.env.DR_API_BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const password = 'smoke-password-01';
const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `smoke-${unique}@example.test`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const details = typeof body === 'object' && body ? JSON.stringify(body) : String(body);
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${details}`);
  }

  return body as T;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

async function command(accessToken: string, characterId: string, input: string): Promise<CommandResult> {
  return request<CommandResult>('/v1/command', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ characterId, command: input }),
  });
}

async function pathCommands(from: string, to: string): Promise<string[]> {
  const path = await request<{ path: string[] }>(
    `/v1/world/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return path.path;
}

async function walkTo(accessToken: string, character: CharacterSummary, roomId: string): Promise<CharacterSummary> {
  const steps = await pathCommands(character.roomId, roomId);
  let current = character;

  for (const step of steps) {
    const ready = await command(accessToken, current.id, 'wait 900');
    current = ready.character;

    const moved = await command(accessToken, current.id, step);
    current = moved.character;
  }

  assert(current.roomId === roomId, `Expected to arrive at ${roomId}, got ${current.roomId}`);
  return current;
}

async function advanceToCircle(
  accessToken: string,
  character: CharacterSummary,
  targetCircle: number,
): Promise<CharacterSummary> {
  let current = character;
  let attempts = 0;

  while (current.circle < targetCircle && attempts < 800) {
    attempts += 1;
    let result = await command(accessToken, current.id, 'circle');
    current = result.character;

    if (current.circle >= targetCircle) break;
    if (result.events.some((event) => event.includes('advance to Circle'))) continue;

    const ready = await command(accessToken, current.id, 'wait 900');
    current = ready.character;

    result = await command(accessToken, current.id, 'train');
    current = result.character;
    assert(
      result.events.some((event) => event.includes('drill') || event.includes('improves')),
      `Expected training output while advancing, got: ${result.events.join(' | ')}`,
    );

    await command(accessToken, current.id, 'wait 900');
  }

  assert(current.circle >= targetCircle, `Expected Circle ${targetCircle}, got Circle ${current.circle}`);
  return current;
}

async function createContext(): Promise<SmokeContext> {
  await request<JsonObject>('/health');

  const races = await request<{ races: RaceSummary[] }>('/v1/races');
  assert(races.races.length >= 1, 'Expected at least one race.');

  await request<JsonObject>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName: 'Smoke Runner' }),
  });

  const login = await request<AuthTokens>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(login.accessToken, 'Expected login access token.');

  const character = await request<CharacterSummary>('/v1/characters', {
    method: 'POST',
    headers: authHeaders(login.accessToken),
    body: JSON.stringify({ name: `Smoke${unique.slice(-6)}`, race: races.races[0].name }),
  });

  return {
    accessToken: login.accessToken,
    account: email,
    races: races.races,
    character,
    summary: {
      account: email,
      suite: requestedSuite,
    },
  };
}

async function runIdentitySuite(context: SmokeContext): Promise<void> {
  let current = context.character;

  for (const race of context.races) {
    current = await request<CharacterSummary>(`/v1/characters/${current.id}/reroll`, {
      method: 'POST',
      headers: authHeaders(context.accessToken),
      body: JSON.stringify({ race: race.name }),
    });
    assert(
      current.race === race.id || current.race.toLowerCase() === race.name.toLowerCase(),
      `Expected reroll race ${race.name}, got ${current.race}`,
    );
  }

  context.character = current;
  context.summary.racesRolled = context.races.length;
}

async function runScriptSuite(context: SmokeContext): Promise<void> {
  const script = await request<ScriptRecord>('/v1/scripts', {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({
      name: `Smoke route prep ${unique}`,
      description: 'Reusable API smoke script created by npm run smoke:api.',
      commands: ['look', 'exits', 'inventory'],
    }),
  });
  assert(script.id, 'Expected created script id.');

  const scriptRun = await request<{ steps: unknown[] }>(`/v1/scripts/${script.id}/run`, {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({ characterId: context.character.id, continueOnError: false, paceMs: 0 }),
  });
  assert(scriptRun.steps.length === 3, `Expected 3 script steps, got ${scriptRun.steps.length}`);

  context.summary.scriptSteps = scriptRun.steps.length;
}

async function runProgressionSuite(context: SmokeContext): Promise<void> {
  const guilds = await request<{ guilds: GuildSummary[] }>('/v1/world/guilds');
  assert(guilds.guilds.length >= 1, 'Expected at least one guild room.');

  let current = context.character;
  for (const guild of guilds.guilds) {
    current = await walkTo(context.accessToken, current, guild.roomId);
    const joined = await command(context.accessToken, current.id, 'join guild');
    assert(joined.events.some((event) => event.includes('registered')), `Expected to join ${guild.name}.`);
    current = joined.character;
  }

  current = await walkTo(context.accessToken, current, guilds.guilds[0].roomId);
  current = (await command(context.accessToken, current.id, 'join guild')).character;
  current = await advanceToCircle(context.accessToken, current, 10);

  context.character = current;
  context.summary.guildRoomsWalked = guilds.guilds.length;
  context.summary.circleReached = current.circle;
}

async function runEconomySuite(context: SmokeContext): Promise<void> {
  const shops = await request<{ shops: ShopRoomSummary[] }>('/v1/world/shops');
  assert(shops.shops.length >= 1, 'Expected at least one shop room.');

  let current = context.character;
  let testedShopEconomy = false;

  for (const shopRoom of shops.shops) {
    current = await walkTo(context.accessToken, current, shopRoom.roomId);
    const shop = await command(context.accessToken, current.id, 'shop');
    assert(shop.events.some((event) => event.includes(shopRoom.shop.name)), `Expected shop listing for ${shopRoom.shop.name}`);
    current = shop.character;

    if (!testedShopEconomy && shopRoom.shop.items.length > 0) {
      const item = shopRoom.shop.items[0];
      current = (await command(context.accessToken, current.id, 'wait 900')).character;
      const inventoryBefore = current.inventory.length;
      const bought = await command(context.accessToken, current.id, `shop buy ${item.code}`);
      assert(bought.events.some((event) => event.includes(`You buy ${item.name}`)), `Expected buy output for ${item.name}`);
      assert(bought.character.inventory.length === inventoryBefore + 1, `Expected inventory to gain ${item.code}`);

      await command(context.accessToken, bought.character.id, 'wait 450');

      const sold = await command(context.accessToken, bought.character.id, `shop sell ${item.code}`);
      assert(sold.events.some((event) => event.includes(`You sell ${item.name}`)), `Expected sell output for ${item.name}`);
      assert(sold.character.inventory.length === inventoryBefore, `Expected inventory to remove ${item.code}`);
      current = sold.character;
      testedShopEconomy = true;
    }
  }

  assert(testedShopEconomy, 'Expected to buy and sell at least one shop item.');
  context.character = current;
  context.summary.shopRoomsWalked = shops.shops.length;
  context.summary.shopEconomyChecked = true;
}

async function runCombatSuite(context: SmokeContext): Promise<void> {
  let current = await walkTo(context.accessToken, context.character, 'crossing-RV02-002');
  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  let result = await command(context.accessToken, current.id, 'scan');
  assert(result.events.some((event) => event.includes('forage wolf-cub')), 'Expected scan to list forage wolf-cub.');
  assert(result.events.some((event) => event.includes('Vitality estimates')), 'Expected scan stat explanation.');
  assert(result.targets.some((target) => target.name === 'forage wolf-cub'), 'Expected structured target forage wolf-cub.');

  result = await command(context.accessToken, current.id, 'help scan');
  assert(result.events.some((event) => event.includes('advance <target>')), 'Expected help scan target action guidance.');
  assert(result.events.some((event) => event.includes('Vitality estimates')), 'Expected help scan metadata guidance.');

  result = await command(context.accessToken, current.id, 'target forage wolf-cub');
  assert(result.events.some((event) => event.includes('Target: forage wolf-cub')), 'Expected target details name.');
  assert(result.events.some((event) => event.includes('Vitality: 10 baseline')), 'Expected target baseline vitality.');
  assert(result.events.some((event) => event.includes('Suggested next verb: advance forage wolf-cub')), 'Expected target advance suggestion.');

  result = await command(context.accessToken, current.id, 'look');
  assert(result.events.some((event) => event.includes('forage wolf-cub')), 'Expected hunting room look to list forage wolf-cub.');
  assert(result.targets.some((target) => target.name === 'forage wolf-cub'), 'Expected look response target forage wolf-cub.');

  current = await walkTo(context.accessToken, result.character, 'crossing-RV02-004');
  result = await command(context.accessToken, current.id, 'scan');
  assert(result.events.some((event) => event.includes('muddy shell beetle')), 'Expected scan to list muddy shell beetle.');
  assert(result.targets.some((target) => target.name === 'muddy shell beetle'), 'Expected structured target muddy shell beetle.');

  current = await walkTo(context.accessToken, result.character, 'crossing-RV02-005');
  result = await command(context.accessToken, current.id, 'scan');
  assert(result.events.some((event) => event.includes('ridge hare')), 'Expected scan to list ridge hare.');
  assert(result.targets.some((target) => target.name === 'ridge hare'), 'Expected structured target ridge hare.');

  current = await walkTo(context.accessToken, result.character, 'crossing-RV02-002');
  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  result = await command(context.accessToken, current.id, 'advance');
  assert(result.character.combat?.range, 'Expected combat to start after advance.');
  current = result.character;

  result = await command(context.accessToken, current.id, 'range');
  assert(result.events.some((event) => event.includes('You are at')), 'Expected range command output.');

  result = await command(context.accessToken, current.id, 'target');
  assert(result.events.some((event) => event.includes('Range:')), 'Expected engaged target range details.');

  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  if (current.combat?.range !== 'melee') {
    result = await command(context.accessToken, current.id, 'advance');
    current = result.character;
    await command(context.accessToken, current.id, 'wait 900');
  }

  result = await command(context.accessToken, current.id, 'circle');
  assert(result.events.some((event) => event.includes('circle')), 'Expected circle maneuver output.');
  assert(typeof result.character.combat?.advantage === 'number', 'Expected combat advantage in character payload.');

  current = (await command(context.accessToken, result.character.id, 'wait 900')).character;

  result = await command(context.accessToken, current.id, 'jab');
  assert(result.events.some((event) => event.includes('jab') || event.includes('too far away')), 'Expected jab maneuver output.');

  current = (await command(context.accessToken, result.character.id, 'wait 900')).character;

  if (current.combat) {
    result = await command(context.accessToken, current.id, 'defend');
    assert(result.events.some((event) => event.includes('guard')), 'Expected defend recovery output.');

    current = (await command(context.accessToken, result.character.id, 'wait 900')).character;

    result = await command(context.accessToken, current.id, 'flee');
    assert(result.events.some((event) => event.includes('flee')), 'Expected flee output.');
    assert(!result.character.combat, 'Expected flee to clear combat.');
    current = result.character;

    await command(context.accessToken, current.id, 'wait 900');

    result = await command(context.accessToken, current.id, 'advance');
    current = result.character;
    await command(context.accessToken, current.id, 'wait 900');
    if (current.combat?.range !== 'melee') {
      result = await command(context.accessToken, current.id, 'advance');
      current = result.character;
      await command(context.accessToken, current.id, 'wait 900');
    }
  }

  current = (await command(context.accessToken, result.character.id, 'wait 900')).character;

  result = await command(context.accessToken, current.id, 'bash');
  assert(result.events.some((event) => event.includes('bash') || event.includes('too far away')), 'Expected bash maneuver output.');

  const incapacitated = await request<{ character: CharacterSummary }>(`/v1/test/characters/${result.character.id}/state`, {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({ healthCurrent: 0, clearCombat: true }),
  });
  assert(incapacitated.character.health.current === 0, 'Expected fixture to set health to 0.');

  const blocked = await command(context.accessToken, incapacitated.character.id, 'attack');
  assert(blocked.events.some((event) => event.includes('incapacitated')), 'Expected incapacitated command block.');

  const rested = await command(context.accessToken, incapacitated.character.id, 'rest');
  assert(rested.character.health.current > 0, 'Expected rest to recover health from incapacitation.');
  assert(rested.events.some((event) => event.includes('recover')), 'Expected rest recovery output.');

  context.character = rested.character;
  context.summary.finalCombat = rested.character.combat ?? null;
  context.summary.finalRoom = rested.character.roomId;
  context.summary.combatChecked = true;
  context.summary.scanChecked = true;
  context.summary.structuredTargetsChecked = true;
  context.summary.targetDetailsChecked = true;
}

async function runTargetSuite(context: SmokeContext): Promise<void> {
  let current = await walkTo(context.accessToken, context.character, 'crossing-RV02-002');
  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  let result = await command(context.accessToken, current.id, 'scan');
  assert(result.events.some((event) => event.includes('forage wolf-cub')), 'Expected target suite scan to list forage wolf-cub.');
  assert(result.targets.some((target) => target.name === 'forage wolf-cub'), 'Expected target suite structured wolf-cub.');

  result = await command(context.accessToken, current.id, 'help targets');
  assert(result.events.some((event) => event.includes('advance <target>')), 'Expected help targets action guidance.');

  result = await command(context.accessToken, current.id, 'target forage wolf-cub');
  assert(result.events.some((event) => event.includes('Target: forage wolf-cub')), 'Expected target details name.');
  assert(result.events.some((event) => event.includes('Suggested next verb: advance forage wolf-cub')), 'Expected target details suggestion.');

  result = await command(context.accessToken, current.id, 'appraise forage wolf-cub');
  assert(result.events.some((event) => event.includes('Aggression: 55')), 'Expected appraise target aggression.');

  result = await command(context.accessToken, current.id, 'advance forage wolf-cub');
  assert(result.character.combat?.range, 'Expected target suite engagement.');

  result = await command(context.accessToken, result.character.id, 'target');
  assert(result.events.some((event) => event.includes('Range:')), 'Expected target suite engaged range details.');

  context.character = result.character;
  context.summary.finalCombat = result.character.combat ?? null;
  context.summary.finalRoom = result.character.roomId;
  context.summary.scanChecked = true;
  context.summary.structuredTargetsChecked = true;
  context.summary.targetDetailsChecked = true;
}

async function runSuite(context: SmokeContext, suite: SmokeSuite): Promise<void> {
  if (suite === 'identity') await runIdentitySuite(context);
  if (suite === 'scripts') await runScriptSuite(context);
  if (suite === 'progression') await runProgressionSuite(context);
  if (suite === 'economy') await runEconomySuite(context);
  if (suite === 'targets') await runTargetSuite(context);
  if (suite === 'combat') await runCombatSuite(context);
  if (suite === 'all') {
    await runIdentitySuite(context);
    await runScriptSuite(context);
    await runProgressionSuite(context);
    await runEconomySuite(context);
    await runCombatSuite(context);
  }
}

async function main(): Promise<void> {
  assert(suites.includes(requestedSuite), `Unknown smoke suite "${requestedSuite}". Expected one of: ${suites.join(', ')}`);

  const context = await createContext();
  await runSuite(context, requestedSuite);

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...context.summary,
        finalRoom: context.character.roomId,
        finalCombat: context.character.combat ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
