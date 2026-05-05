type JsonObject = Record<string, unknown>;

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
  combat?: {
    range: 'missile' | 'pole' | 'melee';
    advantage: number;
  };
}

interface CommandResult {
  events: string[];
  character: CharacterSummary;
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
  };
}

interface ScriptRecord {
  id: string;
}

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
    const moved = await command(accessToken, current.id, step);
    current = moved.character;
    await command(accessToken, current.id, 'wait 900');
  }

  assert(current.roomId === roomId, `Expected to arrive at ${roomId}, got ${current.roomId}`);
  return current;
}

async function main(): Promise<void> {
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

  let character = await request<CharacterSummary>('/v1/characters', {
    method: 'POST',
    headers: authHeaders(login.accessToken),
    body: JSON.stringify({ name: `Smoke${unique.slice(-6)}`, race: races.races[0].name }),
  });

  for (const race of races.races) {
    character = await request<CharacterSummary>(`/v1/characters/${character.id}/reroll`, {
      method: 'POST',
      headers: authHeaders(login.accessToken),
      body: JSON.stringify({ race: race.name }),
    });
    assert(
      character.race === race.id || character.race.toLowerCase() === race.name.toLowerCase(),
      `Expected reroll race ${race.name}, got ${character.race}`,
    );
  }

  const script = await request<ScriptRecord>('/v1/scripts', {
    method: 'POST',
    headers: authHeaders(login.accessToken),
    body: JSON.stringify({
      name: `Smoke route prep ${unique}`,
      description: 'Reusable API smoke script created by npm run smoke:api.',
      commands: ['look', 'exits', 'inventory'],
    }),
  });
  assert(script.id, 'Expected created script id.');

  const scriptRun = await request<{ steps: unknown[] }>(`/v1/scripts/${script.id}/run`, {
    method: 'POST',
    headers: authHeaders(login.accessToken),
    body: JSON.stringify({ characterId: character.id, continueOnError: false, paceMs: 0 }),
  });
  assert(scriptRun.steps.length === 3, `Expected 3 script steps, got ${scriptRun.steps.length}`);

  const guilds = await request<{ guilds: GuildSummary[] }>('/v1/world/guilds');
  assert(guilds.guilds.length >= 1, 'Expected at least one guild room.');

  for (const guild of guilds.guilds) {
    character = await walkTo(login.accessToken, character, guild.roomId);
  }

  const shops = await request<{ shops: ShopRoomSummary[] }>('/v1/world/shops');
  assert(shops.shops.length >= 1, 'Expected at least one shop room.');

  for (const shopRoom of shops.shops) {
    character = await walkTo(login.accessToken, character, shopRoom.roomId);
    const shop = await command(login.accessToken, character.id, 'shop');
    assert(shop.events.some((event) => event.includes(shopRoom.shop.name)), `Expected shop listing for ${shopRoom.shop.name}`);
    character = shop.character;
  }

  character = await walkTo(login.accessToken, character, 'crossing-RV02-002');

  let result = await command(login.accessToken, character.id, 'advance');
  assert(result.character.combat?.range, 'Expected combat to start after advance.');
  character = result.character;

  result = await command(login.accessToken, character.id, 'range');
  assert(result.events.some((event) => event.includes('You are at')), 'Expected range command output.');

  result = await command(login.accessToken, character.id, 'wait 900');
  character = result.character;

  if (character.combat?.range !== 'melee') {
    result = await command(login.accessToken, character.id, 'advance');
    character = result.character;
    await command(login.accessToken, character.id, 'wait 900');
  }

  result = await command(login.accessToken, character.id, 'circle');
  assert(result.events.some((event) => event.includes('circle')), 'Expected circle maneuver output.');
  assert(typeof result.character.combat?.advantage === 'number', 'Expected combat advantage in character payload.');

  result = await command(login.accessToken, result.character.id, 'wait 900');
  character = result.character;

  result = await command(login.accessToken, character.id, 'jab');
  assert(result.events.some((event) => event.includes('jab') || event.includes('too far away')), 'Expected jab maneuver output.');

  result = await command(login.accessToken, result.character.id, 'wait 900');
  character = result.character;

  result = await command(login.accessToken, character.id, 'bash');
  assert(result.events.some((event) => event.includes('bash') || event.includes('too far away')), 'Expected bash maneuver output.');

  console.log(
    JSON.stringify(
      {
        ok: true,
        account: email,
        racesRolled: races.races.length,
        guildRoomsWalked: guilds.guilds.length,
        shopRoomsWalked: shops.shops.length,
        finalRoom: result.character.roomId,
        finalCombat: result.character.combat ?? null,
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
