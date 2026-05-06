type JsonObject = Record<string, unknown>;

type SmokeSuite = 'all' | 'identity' | 'guilds' | 'race-guild-matrix' | 'scripts' | 'progression' | 'economy' | 'damaged-ammo' | 'targets' | 'combat';

const canonicalGuildIds = [
  'barbarian',
  'bard',
  'cleric',
  'empath',
  'moon_mage',
  'necromancer',
  'paladin',
  'ranger',
  'thief',
  'trader',
  'warrior_mage',
] as const;

interface AuthTokens {
  accessToken: string;
}

interface RaceSummary {
  id: string;
  name: string;
  description?: string;
  fixedStartingStats: Record<string, number>;
  roles?: unknown;
  statModifiers?: unknown;
}

interface CharacterSummary {
  id: string;
  name: string;
  race: string;
  role?: string;
  roleTitle?: string;
  guildId: string;
  guildName: string;
  roomId: string;
  circle: number;
  stats: Record<string, number>;
  rollProfileVersion?: number;
  statGenerationMode?: string;
  inventory: string[];
  ammoPouch?: Record<string, number>;
  loadedAmmo?: Record<string, string>;
  recoverableAmmo?: Record<string, number>;
  worn?: string[];
  equipment?: Record<string, string>;
  hands: {
    left: string | null;
    right: string | null;
  };
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
  itemDetails: ItemDetail[];
}

interface ItemDetail {
  code: string;
  name: string;
  category: string;
  value: number;
  currency: string;
  slot?: string;
  armor: number;
  evasionPenalty: number;
  attackModifier: number;
  weaponRange?: string;
  validAttackRanges?: string[];
  trainingSkill?: string;
  ammoCode?: string;
  ammoName?: string;
  bundleSize?: number;
  quantity?: number;
  carried: boolean;
  shopAvailable: boolean;
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
  name?: string;
  commands?: string[];
}

interface SmokeContext {
  accessToken: string;
  account: string;
  races: RaceSummary[];
  character: CharacterSummary;
  summary: Record<string, unknown>;
}

const suites: SmokeSuite[] = ['all', 'identity', 'guilds', 'race-guild-matrix', 'scripts', 'progression', 'economy', 'damaged-ammo', 'targets', 'combat'];
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

async function requestFailure(path: string, options: RequestInit = {}): Promise<string> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  assert(!response.ok, `Expected ${options.method ?? 'GET'} ${path} to fail.`);
  return typeof body === 'object' && body && 'error' in body ? String(body.error) : JSON.stringify(body);
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
  const forbiddenRaceDescriptionWords = ['archetype', 'baseline', 'profile', 'brawler', 'skirmisher', 'broker', 'tinker', 'berserker'];
  for (const race of races.races) {
    assert(Object.keys(race.fixedStartingStats ?? {}).length === 8, `Expected fixed starting stats for ${race.name}.`);
    assert(!race.roles, `Expected public race API to omit prototype role data for ${race.name}.`);
    assert(!race.statModifiers, `Expected public race API to omit prototype stat modifiers for ${race.name}.`);
    for (const forbidden of forbiddenRaceDescriptionWords) {
      assert(!race.description?.toLowerCase().includes(forbidden), `Expected ${race.name} public description to omit ${forbidden}.`);
    }
  }

  await request<JsonObject>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName: 'Smoke Runner' }),
  });

  const login = await request<AuthTokens>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(login.accessToken, 'Expected login access token.');

  const guildCreationError = await requestFailure('/v1/characters', {
    method: 'POST',
    headers: authHeaders(login.accessToken),
    body: JSON.stringify({ name: `Guild${unique.slice(-6)}`, race: races.races[0].name, guildId: 'barbarian' }),
  });
  assert(guildCreationError.includes('Guild is not selected during character creation'), 'Expected guild-at-creation rejection.');

  const character = await request<CharacterSummary>('/v1/characters', {
    method: 'POST',
    headers: authHeaders(login.accessToken),
    body: JSON.stringify({ name: `Smoke${unique.slice(-6)}`, race: races.races[0].name }),
  });
  assert(character.guildId === 'commoner', `Expected new character to start commoner, got ${character.guildId}.`);
  assert(character.guildName === 'Unaffiliated', `Expected new character to start unaffiliated, got ${character.guildName}.`);

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
    assert(current.circle === 1, `Expected ${race.name} reroll to remain Circle 1, got Circle ${current.circle}.`);
    assert(current.statGenerationMode === 'modern_fixed', `Expected ${race.name} reroll to use modern_fixed stats.`);
    assert(JSON.stringify(current.stats) === JSON.stringify(race.fixedStartingStats), `Expected ${race.name} stats to match fixed starting stats.`);
  }

  context.character = current;
  context.summary.racesRolled = context.races.length;
  context.summary.circleOneRacesChecked = context.races.length;
  context.summary.modernFixedStatsChecked = true;
  context.summary.fixedRaceStatsChecked = context.races.length;
  context.summary.guildCreationRejected = true;
  context.summary.creationStartsUnaffiliated = true;
  context.summary.cleanRaceDescriptionsChecked = context.races.length;

  const legacyModern = await request<CommandResult>(`/v1/test/characters/${current.id}/state`, {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({ legacyRaceMetadata: 'modern' }),
  });
  assert(legacyModern.character.statGenerationMode === 'modern_fixed', 'Expected legacy missing stat mode to normalize to modern_fixed.');
  assert(legacyModern.character.role === 'modern_fixed', `Expected legacy modern role to normalize, got ${legacyModern.character.role}.`);
  assert(legacyModern.character.roleTitle === 'Modern fixed racial start', `Expected legacy modern role title to normalize, got ${legacyModern.character.roleTitle}.`);

  const legacyClassic = await request<CommandResult>(`/v1/test/characters/${current.id}/state`, {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({ legacyRaceMetadata: 'classic' }),
  });
  assert(legacyClassic.character.statGenerationMode === 'classic_random', 'Expected explicit legacy classic mode to remain classic_random.');
  assert(
    String(legacyClassic.character.roleTitle ?? '').startsWith('Private classic-random test profile '),
    `Expected legacy classic role title to be private, got ${legacyClassic.character.roleTitle}.`,
  );

  const legacyScore = await command(context.accessToken, current.id, 'score');
  assert(legacyScore.events.some((event) => event.includes('classic random roll')), 'Expected score to report classic random roll mode.');
  assert(!legacyScore.events.some((event) => event.includes('Berserker') || event.includes('Frontline')), 'Expected score to avoid legacy prototype role labels.');

  current = await request<CharacterSummary>(`/v1/characters/${current.id}/reroll`, {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({ race: context.races[0].name, statMode: 'modern_fixed' }),
  });
  context.character = current;
  context.summary.storedRaceMetadataApiMigrationChecked = true;
}

async function runGuildEndpointSuite(context: SmokeContext): Promise<void> {
  const guilds = await request<{ guilds: GuildSummary[] }>('/v1/world/guilds');
  const ids = guilds.guilds.map((guild) => guild.id).sort();
  const canonicalIds = [...canonicalGuildIds].sort();

  assert(guilds.guilds.length === canonicalGuildIds.length, `Expected exactly ${canonicalGuildIds.length} canonical DragonRealms guilds, got ${guilds.guilds.length}.`);
  assert(JSON.stringify(ids) === JSON.stringify(canonicalIds), `Expected only canonical DragonRealms guild ids, got ${ids.join(', ')}.`);

  for (const guild of guilds.guilds) {
    assert(canonicalGuildIds.includes(guild.id as typeof canonicalGuildIds[number]), `Expected ${guild.id} to be canonical.`);
    assert(typeof guild.name === 'string' && guild.name.trim().length > 0, `Expected guild ${guild.id} to have a name.`);
    assert(typeof guild.roomId === 'string' && guild.roomId.startsWith('crossing-'), `Expected guild ${guild.id} to expose a Crossing registrar room id.`);
  }

  context.summary.guildEndpointChecked = true;
  context.summary.guildEndpointCanonicalCount = guilds.guilds.length;
  context.summary.guildEndpointRegistrarRoomsChecked = guilds.guilds.length;
  context.summary.guildEndpointOnlyCanonical = true;
}

async function runRaceGuildMatrixSuite(context: SmokeContext): Promise<void> {
  const guilds = await request<{ guilds: GuildSummary[] }>('/v1/world/guilds');
  const canonicalGuilds = canonicalGuildIds.map((guildId) => {
    const guild = guilds.guilds.find((entry) => entry.id === guildId);
    assert(guild, `Expected canonical DragonRealms-style guild ${guildId} to be present.`);
    return guild;
  });

  let combinationsChecked = 0;
  const raceNamesChecked = new Set<string>();
  const guildIdsChecked = new Set<string>();

  for (const race of context.races) {
    raceNamesChecked.add(race.name);

    for (const guild of canonicalGuilds) {
      const character = await request<CharacterSummary>('/v1/characters', {
        method: 'POST',
        headers: authHeaders(context.accessToken),
        body: JSON.stringify({
          name: `Mx${combinationsChecked}${unique.slice(-5)}`.slice(0, 40),
          race: race.name,
        }),
      });
      assert(
        character.race === race.id || character.race.toLowerCase() === race.name.toLowerCase(),
        `Expected matrix character race ${race.name}, got ${character.race}.`,
      );
      assert(character.circle === 1, `Expected new ${race.name} character to start Circle 1, got Circle ${character.circle}.`);
      assert(character.guildId === 'commoner', `Expected new ${race.name} character to start commoner before guild travel.`);
      assert(character.statGenerationMode === 'modern_fixed', `Expected matrix ${race.name} character to use modern_fixed stats.`);
      assert(JSON.stringify(character.stats) === JSON.stringify(race.fixedStartingStats), `Expected matrix ${race.name} stats to match fixed starting stats.`);

      const arrived = await walkTo(context.accessToken, character, guild.roomId);
      const joined = await command(context.accessToken, arrived.id, 'join guild');
      assert(joined.events.some((event) => event.includes('registered')), `Expected ${race.name} to join ${guild.name}.`);
      assert(joined.character.circle === 1, `Expected ${race.name}/${guild.name} to remain Circle 1 after joining.`);
      assert(joined.character.race === character.race, `Expected ${race.name}/${guild.name} join to preserve race.`);
      assert(joined.character.guildId === guild.id, `Expected ${race.name} to join ${guild.id} only after travel.`);

      combinationsChecked += 1;
      guildIdsChecked.add(guild.id);
      context.character = joined.character;
    }
  }

  context.summary.raceGuildMatrixChecked = combinationsChecked;
  context.summary.raceGuildMatrixRaceCount = raceNamesChecked.size;
  context.summary.raceGuildMatrixGuildCount = guildIdsChecked.size;
  context.summary.raceGuildMatrixCircle = 1;
  context.summary.raceGuildMatrixStartsCommoner = true;
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

  const listed = await request<{ scripts: ScriptRecord[] }>('/v1/scripts', {
    headers: authHeaders(context.accessToken),
  });
  assert(listed.scripts.some((entry) => entry.id === script.id), 'Expected created script in script listing.');

  const deleted = await request<{ deleted: boolean; scriptId: string }>(`/v1/scripts/${script.id}`, {
    method: 'DELETE',
    headers: authHeaders(context.accessToken),
  });
  assert(deleted.deleted === true, 'Expected script deletion confirmation.');
  assert(deleted.scriptId === script.id, 'Expected deleted script id to match created script.');

  const afterDelete = await request<{ scripts: ScriptRecord[] }>('/v1/scripts', {
    headers: authHeaders(context.accessToken),
  });
  assert(!afterDelete.scripts.some((entry) => entry.id === script.id), 'Expected deleted script to be removed from listing.');

  context.summary.scriptSteps = scriptRun.steps.length;
  context.summary.scriptCreatedChecked = true;
  context.summary.scriptRunChecked = true;
  context.summary.scriptDeletedChecked = true;
}

async function runProgressionSuite(context: SmokeContext): Promise<void> {
  const guilds = await request<{ guilds: GuildSummary[] }>('/v1/world/guilds');
  assert(guilds.guilds.length >= 1, 'Expected at least one guild room.');
  const canonicalGuilds = canonicalGuildIds.map((guildId) => {
    const guild = guilds.guilds.find((entry) => entry.id === guildId);
    assert(guild, `Expected canonical DragonRealms-style guild ${guildId} to be present.`);
    return guild;
  });
  const extraGuilds = guilds.guilds.filter((guild) => !canonicalGuildIds.includes(guild.id as typeof canonicalGuildIds[number]));

  let current = context.character;
  for (const guild of canonicalGuilds) {
    current = await walkTo(context.accessToken, current, guild.roomId);
    const joined = await command(context.accessToken, current.id, 'join guild');
    assert(joined.events.some((event) => event.includes('registered')), `Expected to join ${guild.name}.`);
    current = joined.character;
    assert(current.circle === 1, `Expected ${guild.name} join to keep character at Circle 1 before training.`);
  }

  current = await walkTo(context.accessToken, current, canonicalGuilds[0].roomId);
  current = (await command(context.accessToken, current.id, 'join guild')).character;
  current = await advanceToCircle(context.accessToken, current, 10);

  context.character = current;
  context.summary.canonicalGuildRoomsWalked = canonicalGuilds.length;
  context.summary.canonicalGuildsChecked = canonicalGuilds.map((guild) => guild.id);
  context.summary.extraPrototypeGuilds = extraGuilds.map((guild) => guild.id);
  context.summary.guildRoomsWalked = canonicalGuilds.length;
  context.summary.circleReached = current.circle;
}

async function runEconomySuite(context: SmokeContext): Promise<void> {
  const shops = await request<{ shops: ShopRoomSummary[] }>('/v1/world/shops');
  assert(shops.shops.length >= 1, 'Expected at least one shop room.');

  let current = context.character;
  let equipment = await command(context.accessToken, current.id, 'wear leather backpack');
  assert(equipment.events.some((event) => event.includes('You wear leather backpack on your back slot')), 'Expected wear leather backpack output.');
  assert(equipment.character.worn?.includes('leather backpack'), 'Expected worn leather backpack.');
  assert(equipment.character.equipment?.back === 'leather backpack', 'Expected leather backpack in back equipment slot.');
  current = (await command(context.accessToken, equipment.character.id, 'wait 350')).character;

  equipment = await command(context.accessToken, current.id, 'combat');
  assert(equipment.events.some((event) => event.includes('Equipment: armor 0, evasion penalty 0, attack modifier 1')), 'Expected equipment combat modifier summary.');

  equipment = await command(context.accessToken, current.id, 'remove leather backpack');
  assert(equipment.events.some((event) => event.includes('You remove leather backpack')), 'Expected remove leather backpack output.');
  assert(equipment.character.inventory.includes('leather backpack'), 'Expected leather backpack returned to inventory.');
  assert(!equipment.character.equipment?.back, 'Expected back equipment slot to clear.');
  current = (await command(context.accessToken, equipment.character.id, 'wait 350')).character;

  equipment = await command(context.accessToken, current.id, 'hold repair cloth left');
  assert(equipment.events.some((event) => event.includes('You hold repair cloth in your left hand.')), 'Expected hold repair cloth output.');
  assert(equipment.character.hands.left === 'repair cloth', 'Expected repair cloth in left hand.');
  current = (await command(context.accessToken, equipment.character.id, 'wait 300')).character;

  equipment = await command(context.accessToken, current.id, 'stow left');
  assert(equipment.events.some((event) => event.includes('You stow repair cloth from your left hand.')), 'Expected stow repair cloth output.');
  assert(equipment.character.inventory.includes('repair cloth'), 'Expected repair cloth returned to inventory.');
  current = (await command(context.accessToken, equipment.character.id, 'wait 300')).character;

  let testedShopEconomy = false;

  for (const shopRoom of shops.shops) {
    current = await walkTo(context.accessToken, current, shopRoom.roomId);
    const shop = await command(context.accessToken, current.id, 'shop');
    assert(shop.events.some((event) => event.includes(shopRoom.shop.name)), `Expected shop listing for ${shopRoom.shop.name}`);
    assert(shop.itemDetails.some((item) => item.shopAvailable), `Expected structured shop item details for ${shopRoom.shop.name}`);
    current = shop.character;

    if (!testedShopEconomy && shopRoom.shop.items.length > 0) {
      const item = shopRoom.shop.items[0];
      assert(shop.itemDetails.some((detail) => detail.code === item.code), `Expected item details to include ${item.code}`);
      current = (await command(context.accessToken, current.id, 'wait 900')).character;
      const inventoryBefore = current.inventory.length;
      const bought = await command(context.accessToken, current.id, `shop buy ${item.code}`);
      assert(bought.events.some((event) => event.includes(`You buy ${item.name}`)), `Expected buy output for ${item.name}`);
      assert(bought.character.inventory.length === inventoryBefore + 1, `Expected inventory to gain ${item.code}`);
      assert(bought.itemDetails.some((detail) => detail.code === item.code && detail.carried), `Expected bought item details to mark ${item.code} carried`);
      assert(bought.itemDetails.every((detail) => typeof detail.armor === 'number' && typeof detail.evasionPenalty === 'number'), 'Expected structured item combat modifiers.');

      const appraisal = await command(context.accessToken, bought.character.id, `appraise ${item.code}`);
      assert(appraisal.events.some((event) => event.includes(`Item: ${item.name}`)), `Expected item appraisal for ${item.name}`);
      assert(appraisal.events.some((event) => event.includes('Category:')), `Expected item appraisal category for ${item.name}`);
      assert(appraisal.events.some((event) => event.includes('Slot:')), `Expected item appraisal slot/modifier line for ${item.name}`);

      await command(context.accessToken, bought.character.id, 'wait 450');

      const sold = await command(context.accessToken, bought.character.id, `shop sell ${item.code}`);
      assert(sold.events.some((event) => event.includes(`You sell ${item.name}`)), `Expected sell output for ${item.name}`);
      assert(sold.character.inventory.length === inventoryBefore, `Expected inventory to remove ${item.code}`);
      current = sold.character;
      testedShopEconomy = true;
    }
  }

  assert(testedShopEconomy, 'Expected to buy and sell at least one shop item.');

  current = await walkTo(context.accessToken, current, 'crossing-MA01-002');
  current = (await command(context.accessToken, current.id, 'wait 900')).character;
  const arrowBuy = await command(context.accessToken, current.id, 'shop buy itm-sting-arrow');
  assert(arrowBuy.character.ammoPouch?.['itm-sting-arrow'] === 5, 'Expected ammo stack before ammo resale.');
  current = (await command(context.accessToken, arrowBuy.character.id, 'wait 450')).character;
  const arrowSell = await command(context.accessToken, current.id, 'shop sell itm-sting-arrow');
  assert(arrowSell.events.some((event) => event.includes('You sell one practice arrow from your ammo pouch')), 'Expected ammo pouch sell output.');
  assert(arrowSell.events.some((event) => event.includes('4 remain')), 'Expected ammo pouch sell remaining count.');
  assert(arrowSell.character.ammoPouch?.['itm-sting-arrow'] === 4, 'Expected ammo pouch count to decrement on resale.');
  current = arrowSell.character;

  const damagedSeed = await request<CommandResult>(`/v1/test/characters/${current.id}/state`, {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({ inventoryAppend: ['damaged-itm-sting-arrow'] }),
  });
  current = damagedSeed.character;

  const damagedAppraisal = await command(context.accessToken, current.id, 'appraise damaged-itm-sting-arrow');
  assert(damagedAppraisal.events.some((event) => event.includes('Item: damaged practice arrow')), 'Expected damaged arrow appraisal name.');
  assert(damagedAppraisal.events.some((event) => event.includes('Category: salvage')), 'Expected damaged arrow salvage category.');
  assert(damagedAppraisal.events.some((event) => event.includes('broken ranged ammunition')), 'Expected damaged arrow broken ammo description.');

  const damagedSell = await command(context.accessToken, damagedAppraisal.character.id, 'shop sell damaged-itm-sting-arrow');
  assert(damagedSell.events.some((event) => event.includes('You sell damaged practice arrow')), 'Expected damaged arrow sale output.');
  assert(!damagedSell.character.inventory.includes('damaged-itm-sting-arrow'), 'Expected damaged arrow removed from inventory after sale.');
  current = damagedSell.character;

  context.character = current;
  context.summary.shopRoomsWalked = shops.shops.length;
  context.summary.shopEconomyChecked = true;
  context.summary.ammoSellChecked = true;
  context.summary.damagedAmmoEconomyChecked = true;
  context.summary.itemDetailsChecked = true;
  context.summary.equipmentChecked = true;
  context.summary.equipmentSlotsChecked = true;
}

async function runCombatSuite(context: SmokeContext): Promise<void> {
  let current = await walkTo(context.accessToken, context.character, 'crossing-MA01-002');
  current = (await command(context.accessToken, current.id, 'wait 900')).character;
  let result = await command(context.accessToken, current.id, 'shop buy itm-practice-bow');
  assert(result.events.some((event) => event.includes('You buy practice bow')), 'Expected to buy practice bow.');
  assert(result.itemDetails.some((item) => item.code === 'itm-practice-bow' && item.weaponRange === 'ranged'), 'Expected practice bow ranged metadata.');
  current = (await command(context.accessToken, result.character.id, 'wait 450')).character;

  const arrowStackBeforeCombatBuy = current.ammoPouch?.['itm-sting-arrow'] ?? 0;
  result = await command(context.accessToken, current.id, 'shop buy itm-sting-arrow');
  assert(result.events.some((event) => event.includes('You buy practice arrow')), 'Expected to buy practice arrow.');
  assert(result.events.some((event) => event.includes('(5 bundled)')), 'Expected practice arrow bundle buy output.');
  assert(result.character.ammoPouch?.['itm-sting-arrow'] === arrowStackBeforeCombatBuy + 5, 'Expected practice arrows to enter ammo pouch as a stack.');
  assert(result.itemDetails.some((item) => item.code === 'itm-sting-arrow' && item.category === 'ammo' && item.quantity === arrowStackBeforeCombatBuy + 5), 'Expected practice arrow ammo quantity metadata.');
  current = (await command(context.accessToken, result.character.id, 'wait 450')).character;

  result = await command(context.accessToken, current.id, 'stow right');
  assert(result.events.some((event) => event.includes('You stow training sword')), 'Expected to stow starter sword.');
  current = (await command(context.accessToken, result.character.id, 'wait 300')).character;

  result = await command(context.accessToken, current.id, 'wield itm-practice-bow right');
  assert(result.events.some((event) => event.includes('You hold practice bow in your right hand')), 'Expected to wield practice bow.');
  current = (await command(context.accessToken, result.character.id, 'wait 300')).character;

  result = await command(context.accessToken, current.id, 'ammo');
  assert(result.events.some((event) => event.includes(`Ammo pouch: itm-sting-arrow x${arrowStackBeforeCombatBuy + 5}`)), 'Expected ammo command to show quiver count.');
  assert(result.events.some((event) => event.includes('practice bow is not loaded')), 'Expected ammo command to show unloaded bow state.');

  result = await command(context.accessToken, current.id, 'reload');
  assert(result.events.some((event) => event.includes('You load practice arrow into practice bow')), 'Expected reload output.');
  assert(result.events.some((event) => event.includes(`${arrowStackBeforeCombatBuy + 4} remain in your quiver`)), 'Expected reload to report remaining quiver count.');
  assert(result.character.ammoPouch?.['itm-sting-arrow'] === arrowStackBeforeCombatBuy + 4, 'Expected reload to move one arrow out of the pouch.');
  assert(result.character.loadedAmmo?.['itm-practice-bow'] === 'itm-sting-arrow', 'Expected practice bow loaded ammo state.');
  current = (await command(context.accessToken, result.character.id, 'wait 350')).character;

  current = await walkTo(context.accessToken, current, 'crossing-RV02-002');
  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  result = await command(context.accessToken, current.id, 'forage');
  assert(result.events.some((event) => event.includes('You forage carefully')), 'Expected forage output in outskirts.');
  assert(result.character.inventory.some((item) => item.startsWith('foraged-')), 'Expected forage to add an inventory item.');
  current = result.character;

  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  result = await command(context.accessToken, current.id, 'scan');
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
  assert(result.events.some((event) => event.includes('Forageable: difficulty')), 'Expected look to show forage availability.');
  assert(result.room.forage?.items.some((item) => item.code.startsWith('foraged-')), 'Expected room forage metadata.');
  assert(result.events.some((event) => event.includes('forage wolf-cub')), 'Expected hunting room look to list forage wolf-cub.');
  assert(result.targets.some((target) => target.name === 'forage wolf-cub'), 'Expected look response target forage wolf-cub.');

  result = await command(context.accessToken, current.id, 'survey');
  assert(result.events.some((event) => event.includes('Surveying Brushline Forage Fork')), 'Expected survey room header.');
  assert(result.events.some((event) => event.includes('Forage: difficulty')), 'Expected survey forage summary.');
  assert(result.events.some((event) => event.includes('Targets: forage wolf-cub')), 'Expected survey target summary.');
  assert(result.events.some((event) => event.includes('Exits:')), 'Expected survey exit summary.');

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

  const arrowsBefore = current.ammoPouch?.['itm-sting-arrow'] ?? 0;
  result = await command(context.accessToken, current.id, 'fire');
  assert(result.events.some((event) => event.includes('You attack with practice bow (ranged weapon')), 'Expected ranged weapon attack output.');
  assert(result.events.some((event) => event.includes('You loose loaded practice arrow')), 'Expected ranged attack to fire loaded practice arrow.');
  assert(
    result.events.some(
      (event) =>
        event.includes('may be recovered after the fight') ||
        event.includes('damaged and may be recovered') ||
        event.includes('splinters beyond recovery'),
    ),
    'Expected ranged attack to resolve ammo recovery outcome.',
  );
  assert(result.events.some((event) => event.includes(`${arrowsBefore} remain`)), 'Expected ranged attack to report remaining ammo.');
  assert((result.character.ammoPouch?.['itm-sting-arrow'] ?? 0) === arrowsBefore, 'Expected loaded ranged attack not to double-consume pouch ammo.');
  assert(!result.character.loadedAmmo?.['itm-practice-bow'], 'Expected ranged attack to clear loaded ammo state.');
  const recoverableShotCount =
    (result.character.recoverableAmmo?.['itm-sting-arrow'] ?? 0) +
    (result.character.recoverableAmmo?.['damaged-itm-sting-arrow'] ?? 0);
  assert(recoverableShotCount <= 1, 'Expected at most one fired arrow recovery record.');
  assert(!result.events.some((event) => event.includes('too far away')), 'Expected ranged weapon to attack from pole or missile range.');
  context.summary.rangedWeaponRangeChecked = true;
  context.summary.rangedAliasAmmoChecked = true;
  context.summary.ammoBundleChecked = true;
  context.summary.rangedReloadChecked = true;
  current = (await command(context.accessToken, result.character.id, 'wait 900')).character;

  if (current.combat) {
    result = await command(context.accessToken, current.id, 'flee');
    current = (await command(context.accessToken, result.character.id, 'wait 900')).character;
  }

  const arrowsBeforeRecovery = current.ammoPouch?.['itm-sting-arrow'] ?? 0;
  result = await command(context.accessToken, current.id, 'recover arrows');
  assert(
    result.events.some((event) => event.includes('You recover 1')) ||
      result.events.some((event) => event.includes('You find no recoverable ammunition')),
    'Expected recover arrows to report recovered or lost ammunition.',
  );
  assert((result.character.ammoPouch?.['itm-sting-arrow'] ?? 0) >= arrowsBeforeRecovery, 'Expected recovery not to reduce ammo pouch.');
  assert(!result.character.recoverableAmmo?.['itm-sting-arrow'], 'Expected recoverable ammo to clear after recovery.');
  assert(!result.character.recoverableAmmo?.['damaged-itm-sting-arrow'], 'Expected damaged recoverable ammo to clear after recovery.');
  context.summary.ammoRecoveryChecked = true;
  context.summary.ammoDamageLossChecked = true;
  current = (await command(context.accessToken, result.character.id, 'wait 900')).character;

  if (current.combat?.range === 'melee') {
    result = await command(context.accessToken, current.id, 'retreat');
    current = (await command(context.accessToken, result.character.id, 'wait 900')).character;
  }

  result = await command(context.accessToken, current.id, 'stow right');
  assert(result.events.some((event) => event.includes('You stow practice bow')), 'Expected to stow practice bow.');
  current = (await command(context.accessToken, result.character.id, 'wait 300')).character;

  result = await command(context.accessToken, current.id, 'wield training sword right');
  assert(result.events.some((event) => event.includes('You hold training sword')), 'Expected to wield training sword again.');
  current = (await command(context.accessToken, result.character.id, 'wait 300')).character;

  if (!current.combat) {
    result = await command(context.accessToken, current.id, 'advance');
    assert(result.character.combat?.range, 'Expected combat to restart after ranged attack path.');
    current = result.character;
  }

  result = await command(context.accessToken, current.id, 'range');
  assert(result.events.some((event) => event.includes('You are at')), 'Expected range command output.');

  result = await command(context.accessToken, current.id, 'target');
  assert(result.events.some((event) => event.includes('Range:')), 'Expected engaged target range details.');

  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  for (let attempts = 0; current.combat?.range !== 'melee' && attempts < 4; attempts += 1) {
    result = await command(context.accessToken, current.id, 'advance');
    current = (await command(context.accessToken, result.character.id, 'wait 900')).character;
  }

  result = await command(context.accessToken, current.id, 'attack');
  assert(result.events.some((event) => event.includes('You attack with training sword')), 'Expected weapon-aware attack output.');
  context.summary.weaponAttackChecked = true;

  current = (await command(context.accessToken, result.character.id, 'wait 900')).character;

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

  if (!current.combat) {
    result = await command(context.accessToken, current.id, 'advance');
    current = (await command(context.accessToken, result.character.id, 'wait 900')).character;
  }

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
  context.summary.forageChecked = true;
  context.summary.surveyChecked = true;
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

  result = await command(context.accessToken, current.id, 'verb');
  assert(result.events.some((event) => event.includes('Verb groups:')), 'Expected verb groups header.');
  assert(result.events.some((event) => event.includes('Targets: scan, target')), 'Expected target verb group.');

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
  context.summary.verbDiscoveryChecked = true;
}

async function runDamagedAmmoSuite(context: SmokeContext): Promise<void> {
  let current = await walkTo(context.accessToken, context.character, 'crossing-MA01-002');
  current = (await command(context.accessToken, current.id, 'wait 900')).character;

  const seeded = await request<CommandResult>(`/v1/test/characters/${current.id}/state`, {
    method: 'POST',
    headers: authHeaders(context.accessToken),
    body: JSON.stringify({ inventoryAppend: ['damaged-itm-sting-arrow'] }),
  });
  current = seeded.character;

  let result = await command(context.accessToken, current.id, 'appraise damaged-itm-sting-arrow');
  assert(result.events.some((event) => event.includes('Item: damaged practice arrow')), 'Expected focused damaged ammo appraisal name.');
  assert(result.events.some((event) => event.includes('Category: salvage')), 'Expected focused damaged ammo salvage category.');
  assert(result.events.some((event) => event.includes('broken ranged ammunition')), 'Expected focused damaged ammo broken description.');
  assert(
    result.itemDetails.some((item) => item.code === 'damaged-itm-sting-arrow' && item.category === 'salvage' && item.carried),
    'Expected focused damaged ammo structured item details.',
  );

  result = await command(context.accessToken, result.character.id, 'shop sell damaged-itm-sting-arrow');
  assert(result.events.some((event) => event.includes('You sell damaged practice arrow')), 'Expected focused damaged ammo sell output.');
  assert(!result.character.inventory.includes('damaged-itm-sting-arrow'), 'Expected focused damaged ammo removed after sale.');

  context.character = result.character;
  context.summary.finalRoom = result.character.roomId;
  context.summary.damagedAmmoEconomyChecked = true;
  context.summary.damagedAmmoFocusedChecked = true;
}

async function runSuite(context: SmokeContext, suite: SmokeSuite): Promise<void> {
  if (suite === 'identity') await runIdentitySuite(context);
  if (suite === 'guilds') await runGuildEndpointSuite(context);
  if (suite === 'race-guild-matrix') await runRaceGuildMatrixSuite(context);
  if (suite === 'scripts') await runScriptSuite(context);
  if (suite === 'progression') await runProgressionSuite(context);
  if (suite === 'economy') await runEconomySuite(context);
  if (suite === 'damaged-ammo') await runDamagedAmmoSuite(context);
  if (suite === 'targets') await runTargetSuite(context);
  if (suite === 'combat') await runCombatSuite(context);
  if (suite === 'all') {
    await runIdentitySuite(context);
    await runGuildEndpointSuite(context);
    await runRaceGuildMatrixSuite(context);
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
