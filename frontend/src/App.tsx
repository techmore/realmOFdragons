import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

type Stats = {
  strength: number;
  reflex: number;
  agility: number;
  discipline: number;
  stamina: number;
  wisdom: number;
  intelligence: number;
  charisma: number;
};

type RoomCode = {
  town: string;
  square: string;
  zone: string;
};

type Exit = {
  direction: string;
  destination: string;
  details: string;
};

type RoomShopItem = {
  code: string;
  name: string;
  price: number;
  currency: string;
};

type Wallet = {
  plat: number;
  trias: number;
  lucan: number;
  silk: number;
};

type CharacterSkill = {
  name: string;
  rank: number;
  pool: number;
};

type RoomShop = {
  code: string;
  name: string;
  items: RoomShopItem[];
};

type Room = {
  id: string;
  code: RoomCode;
  title: string;
  description: string;
  prompts: string[];
  exits: Exit[];
  shop?: RoomShop;
};

type CombatState = {
  targetId: string;
  targetName: string;
  targetHp: number;
  targetMaxHp: number;
  defendUntil: number;
  nextAttackAt: number;
  range: 'missile' | 'pole' | 'melee';
  advantage: number;
};

type Character = {
  id: string;
  name: string;
  race: string;
  raceDisplayName: string;
  role: string;
  roleTitle: string;
  guildId: string;
  guildName: string;
  circle: number;
  skills: Record<string, CharacterSkill>;
  roomId: string;
  health: {
    current: number;
    max: number;
  };
  hands: {
    left: string | null;
    right: string | null;
  };
  inventory: string[];
  wallet: Wallet;
  combat?: CombatState;
  stance: 'balanced' | 'offensive' | 'defensive' | 'evasive';
  balance: number;
  stats: Stats;
  rollProfileVersion: number;
  roundtimeMs: number;
};

type CommandResult = {
  character: Character;
  room: Room;
  events: string[];
  targets: RoomTarget[];
};

type RoomTarget = {
  id: string;
  name: string;
  vitality: number;
  aggression: number;
};

type Guild = {
  id: string;
  name: string;
  roomId: string;
};

type ShopSummary = {
  roomId: string;
  title: string;
  shop: RoomShop;
};

type Race = {
  id: string;
  name: string;
  description?: string;
  minStat?: number;
  maxStat?: number;
  statModifiers?: Record<string, number>;
  roles?: Array<{
    id: string;
    title: string;
    rollModifiers?: Record<string, number>;
  }>;
};

type Script = {
  id: string;
  name: string;
  description?: string;
  commands: string[];
  createdAt: string;
  updatedAt: string;
};

type ScriptRunStep = {
  index: number;
  command: string;
  events: string[];
  roomId?: string;
  error?: string;
};

type ScriptRunResponse = {
  scriptId: string;
  executedSteps: number;
  steps: ScriptRunStep[];
  character: Character;
  room: Room;
  targets?: RoomTarget[];
};

type ScriptPreset = {
  id: string;
  name: string;
  description: string;
  commands: string[];
};

type GuildWalkRoute = {
  id: string;
  label: string;
  goto: string;
  back: string;
};

type DirectionButton = {
  label: string;
  command: string;
  title: string;
};

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

type AppAuthState = {
  email: string;
  password: string;
  displayName: string;
};

type ApiCharacterList = {
  characters: Character[];
};

type GameStatusPanelsProps = {
  character: Character | null;
  room: Room | null;
  selectedCharacter: Character | null;
  skillEntries: Array<[string, CharacterSkill]>;
  localTargets?: RoomTarget[];
  loading?: boolean;
  onCommand?: (command: string) => void;
};

const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? 'http://localhost:4000/v1';

const keyMap: Record<string, string> = {
  Digit8: 'n',
  Digit2: 's',
  Digit4: 'w',
  Digit6: 'e',
  Digit7: 'nw',
  Digit9: 'ne',
  Digit1: 'sw',
  Digit3: 'se',
  Numpad8: 'n',
  Numpad2: 's',
  Numpad4: 'w',
  Numpad6: 'e',
  Numpad7: 'nw',
  Numpad9: 'ne',
  Numpad1: 'sw',
  Numpad3: 'se',
  ArrowUp: 'n',
  ArrowDown: 's',
  ArrowLeft: 'w',
  ArrowRight: 'e',
};

const guildWalkRoute: GuildWalkRoute[] = [
  { id: 'barbarian', label: 'Barbarian', goto: 's', back: 'n' },
  { id: 'bard', label: 'Bard', goto: 'n', back: 's' },
  { id: 'fighter', label: 'Fighter', goto: 'ne', back: 'sw' },
  { id: 'mage', label: 'Mage', goto: 'nw', back: 'se' },
  { id: 'moon_mage', label: 'Moon Mage', goto: 'nw', back: 'se' },
  { id: 'necromancer', label: 'Necromancer', goto: 'nw', back: 'se' },
  { id: 'paladin', label: 'Paladin', goto: 'e', back: 'w' },
  { id: 'ranger', label: 'Ranger', goto: 'se', back: 'nw' },
  { id: 'scout', label: 'Scout', goto: 'se', back: 'nw' },
  { id: 'rogue', label: 'Rogue', goto: 'sw', back: 'ne' },
  { id: 'thief', label: 'Thief', goto: 'sw', back: 'ne' },
  { id: 'trader', label: 'Trader', goto: 'n', back: 's' },
  { id: 'warrior_mage', label: 'Warrior Mage', goto: 's', back: 'n' },
  { id: 'cleric', label: 'Cleric', goto: 'u', back: 'down' },
  { id: 'empath', label: 'Empath', goto: 'n', back: 's' },
];

const directionButtons: DirectionButton[] = [
  { label: '↖', command: 'northwest', title: 'Northwest' },
  { label: '↑', command: 'north', title: 'North' },
  { label: '↗', command: 'northeast', title: 'Northeast' },
  { label: '←', command: 'west', title: 'West' },
  { label: '↻', command: 'exits', title: 'Check exits' },
  { label: '→', command: 'east', title: 'East' },
  { label: '↙', command: 'southwest', title: 'Southwest' },
  { label: '↓', command: 'south', title: 'South' },
  { label: '↘', command: 'southeast', title: 'Southeast' },
  { label: '⌂', command: 'look', title: 'Look around' },
];

const scriptPresets: ScriptPreset[] = [
  {
    id: 'crossing-guild-tour',
    name: 'Crossing guild tour',
    description: 'Walk to every Crossing guild and check their shop lists.',
    commands: [
      '# Crossing guild tour',
      'look',
      'ne',
      'shop',
      'sw',
      'nw',
      'shop',
      'se',
      'se',
      'shop',
      'nw',
      'sw',
      'shop',
      'ne',
      'u',
      'shop',
      'down',
    ],
  },
  {
    id: 'crossing-town-shops',
    name: 'Crossing town shop sweep',
    description: 'Visit market-side locations and the inn room while checking shops.',
    commands: [
      '# Crossing town sweep',
      'look',
      'e',
      'shop',
      'w',
      'n',
      'enter',
      'shop',
      'exit',
      's',
      's',
      'e',
      'shop',
      'wait 150',
      'w',
      'look',
    ],
  },
  {
    id: 'crossing-hunting-loop',
    name: 'Crossing foraging loop',
    description: 'Walk toward the foothill forage route and check the outpost supply stand.',
    commands: ['repeat 2', 's', 's', 'shop', 'n', 'n', 'look', 'end'],
  },
];

function parseScriptLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

async function request<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({ error: 'Invalid response from server.' }));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed: ${response.status}`);
  }
  return data as T;
}

async function requestPublic<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: 'Invalid response from server.' }));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed: ${response.status}`);
  }
  return data as T;
}

function formatTokenError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unknown error occurred.';
}

function formatPrompt(lines: string[], lineLimit = 200) {
  const capped = lines.slice(-lineLimit);
  return capped;
}

function formatWallet(wallet?: Wallet) {
  if (!wallet) {
    return 'wallet unavailable';
  }
  return `${wallet.plat} plat · ${wallet.trias} trias · ${wallet.lucan} lucan · ${wallet.silk} silk`;
}

function findPathBetweenRooms(worldRooms: Record<string, Room>, start: string, destination: string): string[] {
  if (!start || !destination || start === destination) return [];
  const startRoom = worldRooms[start];
  const endRoom = worldRooms[destination];
  if (!startRoom || !endRoom) return [];

  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const predecessor = new Map<string, { from: string; command: string }>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentRoom = worldRooms[current];
    if (!currentRoom) continue;
    for (const exit of currentRoom.exits) {
      const next = exit.destination;
      if (!worldRooms[next] || visited.has(next)) continue;
      visited.add(next);
      predecessor.set(next, { from: current, command: exit.direction });
      if (next === destination) {
        const commands: string[] = [];
        let cursor: string | undefined = destination;
        while (cursor && cursor !== start) {
          const step = predecessor.get(cursor);
          if (!step) break;
          commands.unshift(step.command);
          cursor = step.from;
        }
        return commands;
      }
      queue.push(next);
    }
  }
  return [];
}

function GameStatusPanels({
  character,
  room,
  selectedCharacter,
  skillEntries,
  localTargets = [],
  loading = false,
  onCommand = () => undefined,
}: GameStatusPanelsProps) {
  return (
    <>
      <section className="panel room">
        <h2>Room</h2>
        {room ? (
          <>
            <p>{room.description}</p>
            <div className="prompts">
              {room.prompts.map((prompt) => <p key={prompt}>{prompt}</p>)}
            </div>
            <h3>Exits</h3>
            <div className="exit-list">
              {room.exits.map((exit) => (
                <button type="button" key={exit.destination + exit.direction} onClick={() => onCommand(exit.direction.toLowerCase())}>
                  {exit.direction}
                </button>
              ))}
            </div>
            {room.shop ? (
              <>
                <h3>{room.shop.name}</h3>
                <ul>
                  {room.shop.items.map((item) => (
                    <li key={item.code}>
                      <button type="button" onClick={() => onCommand(`shop buy ${item.code}`)}>
                        buy {item.code}
                      </button>
                      <span>{item.name} ({item.price} {item.currency})</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : (
          <p className="subtle">Load a character to see room details.</p>
        )}
      </section>

      <section className="panel">
        <h2>Controls</h2>
        <div className="action-grid">
          {['look', 'scan', 'score', 'skills', 'circle', 'balance', 'range', 'advance', 'retreat', 'jab', 'bash', 'stance balanced', 'stance offensive', 'stance defensive', 'stance evasive', 'train', 'train melee', 'inventory', 'shop', 'join guild', 'combat', 'attack', 'defend', 'flee', 'rest'].map((entry) => (
            <button type="button" key={entry} onClick={() => onCommand(entry)} disabled={loading || !character}>
              {entry}
            </button>
          ))}
        </div>
        <div className="dpad-grid" role="group" aria-label="Directional movement controls">
          {directionButtons.map((button) => (
            <button
              type="button"
              key={button.command}
              className={button.command === 'exits' || button.command === 'look' ? 'dpad-wide' : ''}
              onClick={() => onCommand(button.command)}
              title={button.title}
              disabled={loading || !character}
            >
              {button.label}
            </button>
          ))}
        </div>
        {localTargets.length ? (
          <>
            <h3>Visible Targets</h3>
            <div className="action-grid">
              {localTargets.map((target) => (
                <span key={target.id} className="target-actions">
                  <strong>{target.name}</strong>
                  <small>Vitality {target.vitality} · Aggression {target.aggression}</small>
                  <button type="button" onClick={() => onCommand(`advance ${target.name}`)} disabled={loading || !character}>
                    advance
                  </button>
                  <button type="button" onClick={() => onCommand(`attack ${target.name}`)} disabled={loading || !character}>
                    attack
                  </button>
                </span>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel equip">
        <h2>Character</h2>
        <p>{selectedCharacter ? `${selectedCharacter.name} | ${selectedCharacter.raceDisplayName} | ${selectedCharacter.roleTitle}` : 'No character selected'}</p>
        <p>{character ? `${character.guildName} | Circle ${character.circle}` : 'No guild data'}</p>
        <p>{character ? `Stance ${character.stance} | Balance ${character.balance}` : 'No combat posture'}</p>
        <div className="stat-grid">
          {character ? (
            <>
              <span>STR {character.stats.strength}</span>
              <span>REF {character.stats.reflex}</span>
              <span>AGI {character.stats.agility}</span>
              <span>DIS {character.stats.discipline}</span>
              <span>STA {character.stats.stamina}</span>
              <span>WIS {character.stats.wisdom}</span>
              <span>INT {character.stats.intelligence}</span>
              <span>CHA {character.stats.charisma}</span>
            </>
          ) : null}
        </div>
        <h3>Hands</h3>
        <p>Right: {character?.hands.right ?? 'empty'}</p>
        <p>Left: {character?.hands.left ?? 'empty'}</p>
        <h3>Skills</h3>
        <ul>
          {skillEntries.map(([id, skill]) => (
            <li key={id}>{skill.name}: {skill.rank} ({skill.pool})</li>
          ))}
        </ul>
        <h3>Inventory</h3>
        <ul>
          {(character?.inventory ?? []).map((item, index) => (
            <li key={`${item}-${index}`}>
              <span>{item}</span>
              <button
                type="button"
                onClick={() => onCommand(`shop sell ${item}`)}
                disabled={!!room && room.shop === undefined}
              >
                sell
              </button>
            </li>
          ))}
        </ul>
        {character?.combat ? (
          <>
            <h3>Combat</h3>
            <p>{character.combat.targetName}: {character.combat.targetHp}/{character.combat.targetMaxHp}</p>
            <p>Range: {character.combat.range}</p>
            <p>Advantage: {character.combat.advantage}</p>
          </>
        ) : null}
      </section>
    </>
  );
}

function App() {
  const [accessToken, setAccessToken] = useState<string>(localStorage.getItem('dr_access_token') ?? '');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authInput, setAuthInput] = useState<AppAuthState>({
    email: '',
    password: '',
    displayName: '',
  });
  const [authMessage, setAuthMessage] = useState<string>('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [character, setCharacter] = useState<Character | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [worldRooms, setWorldRooms] = useState<Record<string, Room>>({});
  const [races, setRaces] = useState<Race[]>([]);
  const [availableScriptPresets, setAvailableScriptPresets] = useState<ScriptPreset[]>(scriptPresets);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [createName, setCreateName] = useState('Explorer');
  const [createRace, setCreateRace] = useState('Human');
  const [rerollRace, setRerollRace] = useState('');
  const [newScriptName, setNewScriptName] = useState('Crossing setup');
  const [newScriptDescription, setNewScriptDescription] = useState('Walk around the Crossing and check shops.');
  const [newScriptCommands, setNewScriptCommands] = useState('look\\nexits\\nne\\nshop\\nsw\\nshop\\nu\\nshop\\ndown\\nscore');
  const [scriptRunPaceMs, setScriptRunPaceMs] = useState(150);
  const [continueOnScriptError, setContinueOnScriptError] = useState(false);
  const [command, setCommand] = useState('');
  const [submittedCommands, setSubmittedCommands] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([
    'Welcome to Clean-Room DR test client.',
    'Register/login, create/select a character, then use numpad or command input.',
  ]);
  const [localTargets, setLocalTargets] = useState<RoomTarget[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const locationLabel = useMemo(() => {
    if (!room) return 'No room loaded';
    return `${room.code.town.toUpperCase()} / ${room.code.zone} (${room.code.square})`;
  }, [room]);

  const selectedRace = useMemo(
    () => races.find((entry) => entry.name === createRace) ?? races[0],
    [races, createRace],
  );

  const selectedCharacter = useMemo(
    () => characters.find((entry) => entry.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId],
  );

  const skillEntries = useMemo(
    () => Object.entries(character?.skills ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    [character],
  );

  const appendHistory = (line: string) => {
    setCommandHistory((current) => formatPrompt([...current, line]));
  };

  const hydrateLookupData = async () => {
    const [raceData, guildData, shopData, roomData] = await Promise.all([
      request<{ races: Race[] }>('/races', { token: accessToken }),
      request<{ guilds: Guild[] }>('/world/guilds', { token: accessToken }),
      request<{ shops: ShopSummary[] }>('/world/shops', { token: accessToken }),
      request<{ rooms: Room[] }>('/world/rooms', { token: accessToken }),
    ]);
    let presets: ScriptPreset[] = [];
    try {
      const presetData = await request<{ presets: ScriptPreset[] }>('/scripts/presets', { token: accessToken });
      presets = presetData.presets ?? [];
    } catch {
      presets = [];
    }
    setRaces(
      raceData.races.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        minStat: entry.minStat,
        maxStat: entry.maxStat,
        statModifiers: entry.statModifiers,
        roles: entry.roles,
      })),
    );
    setGuilds(guildData.guilds);
    setShops(shopData.shops);
    setWorldRooms(
      Object.fromEntries(
        roomData.rooms.map((entry) => [entry.id, entry]),
      ),
    );
    setAvailableScriptPresets((presets.length ? presets : scriptPresets) as ScriptPreset[]);
    if (raceData.races.length) {
      setCreateRace(raceData.races[0].name);
      setRerollRace('');
    }
  };

  const hydrateScripts = async () => {
    const payload = await request<{ scripts: Script[] }>('/scripts', { token: accessToken });
    setScripts(payload.scripts);
  };

  const hydrateCharacters = async (suppressSelection = false) => {
    const data = await request<ApiCharacterList>('/characters', { token: accessToken });
    setCharacters(data.characters);
    if (suppressSelection) return;

    const selected = data.characters.find((entry) => entry.id === selectedCharacterId) ?? data.characters[0];
    if (selected) {
      await hydrateCharacterState(selected.id);
    } else {
      setCharacter(null);
      setRoom(null);
      setSelectedCharacterId('');
    }
  };

  const hydrateCharacterState = async (characterId: string) => {
    const data = await request<{ character: Character; room: Room; targets: RoomTarget[] }>(`/characters/${characterId}/state`, {
      token: accessToken,
    });
    setSelectedCharacterId(characterId);
    setCharacter(data.character);
    setRoom(data.room);
    setLocalTargets(data.targets);
    appendHistory(`Loaded ${data.character.name} in ${data.room.title}.`);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await requestPublic<AuthPayload>('/auth/login', {
        email: authInput.email,
        password: authInput.password,
      });
      setAccessToken(data.accessToken);
      localStorage.setItem('dr_access_token', data.accessToken);
      setAuthMessage('Login successful.');
    } catch (error) {
      setAuthMessage(formatTokenError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await requestPublic<{ id: string }>('/auth/register', {
        email: authInput.email,
        password: authInput.password,
        displayName: authInput.displayName,
      });
      setAuthMessage('Account created. Switch to login to continue.');
      setAuthMode('login');
    } catch (error) {
      setAuthMessage(formatTokenError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCharacter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createName.trim()) {
      appendHistory('Enter a character name first.');
      return;
    }
    setLoading(true);
    try {
      const payload = await request<Character>('/characters', {
        method: 'POST',
        token: accessToken,
        body: {
          name: createName.trim(),
          race: createRace,
        },
      });
      appendHistory(`Created ${payload.name} (${payload.raceDisplayName} / ${payload.roleTitle}).`);
      setCreateName('Explorer');
      await hydrateCharacters(true);
      setCharacters((current) => [payload, ...current]);
      await hydrateCharacterState(payload.id);
    } catch (error) {
      appendHistory(`Character creation failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const runCommand = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || !character) return;
    setLoading(true);
    appendHistory(`> ${trimmed}`);
    try {
      const result = await executeCommand(trimmed);
      applyCommandResult(result);
    } catch (error) {
      appendHistory(`Command failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (commandText: string) => {
    if (!character) {
      throw new Error('No active character selected.');
    }
    const result = await request<CommandResult>('/command', {
      method: 'POST',
      token: accessToken,
      body: {
        characterId: character.id,
        command: commandText,
      },
    });
    return result;
  };

  const applyCommandResult = (result: CommandResult) => {
    setCharacter(result.character);
    setRoom(result.room);
    setCharacters((current) => current.map((entry) => (entry.id === result.character.id ? result.character : entry)));
    setLocalTargets(result.targets);
    for (const event of result.events) {
      appendHistory(event);
    }
  };

  const runCommandSequence = async (commands: string[]) => {
    let cursorRoom = room;
    for (const entry of commands) {
      const result = await executeCommand(entry);
      applyCommandResult(result);
      cursorRoom = result.room;
      if (result.character.roundtimeMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1200, result.character.roundtimeMs)));
      }
    }
    return cursorRoom;
  };

  const runQuickGuildVisit = async (route: GuildWalkRoute) => {
    if (!character || !Object.keys(worldRooms).length) return;
    setLoading(true);
    appendHistory(`Visiting ${route.label} guild for live validation.`);
    try {
      const guild = guilds.find((entry) => entry.id === route.id);
      if (!guild) {
        appendHistory(`No guild data for ${route.label}.`);
        return;
      }
      const commands = findPathBetweenRooms(worldRooms, character.roomId, guild.roomId);
      if (commands.length) {
        await runCommandSequence(commands);
      } else if (character.roomId !== guild.roomId) {
        appendHistory(`No route available to ${route.label}.`);
        return;
      }
      const viewedShop = await executeCommand('shop');
      applyCommandResult(viewedShop);
    } catch (error) {
      appendHistory(`Guild visit failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const runTourAllGuilds = async () => {
    if (!character) return;
    setLoading(true);
    if (!Object.keys(worldRooms).length) {
      appendHistory('World map unavailable. Reload login and try again.');
      setLoading(false);
      return;
    }
    appendHistory('Starting auto routing tour for Crossing guilds + shops...');
    try {
      const targetRooms = new Map<string, { roomId: string; label: string }>();
      for (const guild of guilds) {
        targetRooms.set(guild.roomId, { roomId: guild.roomId, label: `${guild.name} Guild` });
      }
      for (const shop of shops) {
        const targetRoom = worldRooms[shop.roomId];
        if (!targetRoom) continue;
        targetRooms.set(shop.roomId, { roomId: shop.roomId, label: shop.shop?.name ?? `Shop in ${targetRoom.title}` });
      }

      const orderedTargets = [...targetRooms.values()];
      let cursorRoomId = character.roomId;
      for (const target of orderedTargets) {
        if (target.roomId === cursorRoomId) {
          const localRoom = worldRooms[target.roomId];
          if (localRoom?.shop) {
            appendHistory(`At target: ${target.label}`);
            const shopResult = await executeCommand('shop');
            applyCommandResult(shopResult);
          }
          continue;
        }

        const commands = findPathBetweenRooms(worldRooms, cursorRoomId, target.roomId);
        if (!commands.length) {
          appendHistory(`No route available to ${target.label}. Skipping.`);
          continue;
        }

        appendHistory(`→ ${target.label}`);
        await runCommandSequence(commands);
        const currentRoom = worldRooms[target.roomId];
        cursorRoomId = target.roomId;
        if (currentRoom?.shop) {
          const shopResult = await executeCommand('shop');
          applyCommandResult(shopResult);
        }
      }
      appendHistory('Tour complete: visited all known guilds and shop rooms reached.');
    } catch (error) {
      appendHistory(`Tour failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScript = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lines = parseScriptLines(newScriptCommands);
    if (!newScriptName.trim()) {
      appendHistory('Script name is required.');
      return;
    }
    if (!lines.length) {
      appendHistory('Add at least one command line to the script.');
      return;
    }

    setLoading(true);
    try {
      const created = await request<Script>('/scripts', {
        method: 'POST',
        token: accessToken,
        body: {
          name: newScriptName.trim(),
          description: newScriptDescription.trim(),
          commands: lines,
        },
      });
      appendHistory(`Saved script "${created.name}" with ${created.commands.length} commands.`);
      setScripts((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
      setNewScriptName('Crossing script');
    } catch (error) {
      appendHistory(`Script create failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const runScript = async (script: Script) => {
    if (!character) {
      appendHistory('Select a character first.');
      return;
    }
    setLoading(true);
    appendHistory(`Running script: ${script.name}`);
    try {
      const result = await request<ScriptRunResponse>(`/scripts/${script.id}/run`, {
        method: 'POST',
        token: accessToken,
        body: {
          characterId: character.id,
          paceMs: scriptRunPaceMs,
          continueOnError: continueOnScriptError,
        },
      });
      for (const step of result.steps) {
        if (step.error) {
          appendHistory(`[${step.index + 1}] ${step.command} => ERROR ${step.error}`);
        } else {
          appendHistory(`[${step.index + 1}] ${step.command}`);
        }
        for (const line of step.events) {
          appendHistory(`  ${line}`);
        }
      }
      setCharacter(result.character);
      setRoom(result.room);
      setLocalTargets(result.targets ?? []);
      setCharacters((current) =>
        current.map((entry) => (entry.id === result.character.id ? result.character : entry)),
      );
      appendHistory(`Script finished: ${result.executedSteps} steps.`);
    } catch (error) {
      appendHistory(`Script run failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteScript = async (scriptId: string) => {
    setLoading(true);
    try {
      await request(`/scripts/${scriptId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      setScripts((current) => current.filter((entry) => entry.id !== scriptId));
      appendHistory(`Deleted script.`);
    } catch (error) {
      appendHistory(`Delete failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const rerollCharacter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!character) return;
    setLoading(true);
    try {
      const body = rerollRace ? { race: rerollRace } : {};
      const result = await request<Character & { trace?: string[] }>(`/characters/${character.id}/reroll`, {
        method: 'POST',
        token: accessToken,
        body,
      });
      appendHistory(
        `Rerolled ${result.name}: ${result.raceDisplayName} / ${result.roleTitle} (trace v${result.rollProfileVersion}).`,
      );
      setCharacter(result);
      setCharacters((current) => current.map((entry) => (entry.id === result.id ? result : entry)));
      setRerollRace('');
    } catch (error) {
      appendHistory(`Reroll failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const runRerollAllRaces = async () => {
    if (!character || !races.length) return;
    setLoading(true);
    appendHistory(`Running reroll sweep across ${races.length} races for ${character.name}...`);
    try {
      for (const race of races) {
        const result = await request<Character & { trace?: string[] }>(`/characters/${character.id}/reroll`, {
          method: 'POST',
          token: accessToken,
          body: { race: race.name },
        });
        setCharacter(result);
        setCharacters((current) => current.map((entry) => (entry.id === result.id ? result : entry)));
        appendHistory(`As ${result.raceDisplayName}: ${result.roleTitle} => STR ${result.stats.strength}, DIS ${result.stats.discipline}`);
      }
      appendHistory('Reroll sweep complete.');
    } catch (error) {
      appendHistory(`Reroll sweep failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('dr_access_token');
    setAccessToken('');
    setCharacters([]);
    setSelectedCharacterId('');
    setCharacter(null);
    setRoom(null);
    setStatus('Signed out.');
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = command.trim();
    if (trimmed) {
      setSubmittedCommands((current) => [...current.slice(-49), trimmed]);
      setHistoryCursor(null);
    }
    void runCommand(command);
    setCommand('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' && submittedCommands.length) {
      event.preventDefault();
      const nextCursor = historyCursor === null ? submittedCommands.length - 1 : Math.max(0, historyCursor - 1);
      setHistoryCursor(nextCursor);
      setCommand(submittedCommands[nextCursor] ?? '');
      return;
    }
    if (event.key === 'ArrowDown' && submittedCommands.length) {
      event.preventDefault();
      if (historyCursor === null) return;
      const nextCursor = historyCursor + 1;
      if (nextCursor >= submittedCommands.length) {
        setHistoryCursor(null);
        setCommand('');
      } else {
        setHistoryCursor(nextCursor);
        setCommand(submittedCommands[nextCursor] ?? '');
      }
      return;
    }
    if (!character || loading) return;
    const mapped = keyMap[event.code];
    if (!mapped) return;
    event.preventDefault();
    void runCommand(mapped);
  };

  useEffect(() => {
    const element = logRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [commandHistory]);

  useEffect(() => {
    if (!accessToken) return;
    setStatus('');
    (async () => {
      try {
        setLoading(true);
        await hydrateLookupData();
        await hydrateScripts();
        await hydrateCharacters();
      } catch (error) {
        setStatus(formatTokenError(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  if (!accessToken) {
    return (
      <main className="app-shell">
        <section className="hud">
          <header className="panel">
            <h1>Clean-Room DR Client</h1>
            <p className="prompt">No active session. Register or login.</p>
            <p className="subtle">{authMessage}</p>
          </header>

          <section className="columns">
            <article className="panel">
              <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={authInput.email}
                    onChange={(event) => setAuthInput((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={authInput.password}
                    onChange={(event) => setAuthInput((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>
                {authMode === 'register' && (
                  <label>
                    <span>Display name (optional)</span>
                    <input
                      type="text"
                      value={authInput.displayName}
                      onChange={(event) => setAuthInput((current) => ({ ...current, displayName: event.target.value }))}
                    />
                  </label>
                )}
                <button type="submit" disabled={loading}>
                  {authMode === 'login' ? 'Login' : 'Create account'}
                </button>
              </form>
              <p>
                <button type="button" onClick={() => setAuthMode((current) => (current === 'login' ? 'register' : 'login'))}>
                  Switch to {authMode === 'login' ? 'register' : 'login'}
                </button>
              </p>
            </article>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="mud-shell">
        <header className="topbar">
          <div>
            <h1>DragonRealms Next Gen</h1>
            <p className="location">{locationLabel}</p>
          </div>
          <div className="topbar-stats">
            <span>{character ? `${character.name} | ${character.guildName} | Circle ${character.circle}` : 'No character selected'}</span>
            <span>{character ? `Health ${character.health.current}/${character.health.max}` : 'Health --'}</span>
            <span>{character ? `RT ${Math.max(0, Math.round(character.roundtimeMs))}ms` : 'RT --'}</span>
            <button type="button" onClick={logout} disabled={loading}>Logout</button>
          </div>
        </header>

        <section className="mud-main">
          <article className="terminal-pane">
            <div className="terminal-title">
              <span>{room?.title ?? 'No Room Loaded'}</span>
              <span>{character ? formatWallet(character.wallet) : 'No wallet'}</span>
            </div>
            <div className="log" ref={logRef}>
              {commandHistory.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </div>
            <form className="command-row" onSubmit={onSubmit}>
              <span>&gt;</span>
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="look | exits | score | range | advance | circle | jab | bash | retreat"
              />
            </form>
            {status && <p className="subtle">{status}</p>}
          </article>

          <aside className="side-pane">
            <GameStatusPanels
              character={character}
              room={room}
              selectedCharacter={selectedCharacter}
              skillEntries={skillEntries}
              localTargets={localTargets}
              loading={loading}
              onCommand={(entry) => void runCommand(entry)}
            />
          </aside>
        </section>

        <section className="management-grid">
          <article className="panel">
            <h2>Characters</h2>
            <form onSubmit={handleCreateCharacter}>
              <label>
                <span>Name</span>
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} />
              </label>
              <label>
                <span>Race</span>
                <select value={createRace} onChange={(event) => setCreateRace(event.target.value)}>
                  {races.map((race) => <option key={race.id} value={race.name}>{race.name}</option>)}
                </select>
              </label>
              <button type="submit" disabled={loading}>Create Character</button>
            </form>
            <div className="character-list">
              {characters.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  disabled={loading || entry.id === selectedCharacterId}
                  onClick={() => void hydrateCharacterState(entry.id)}
                >
                  {entry.name} | {entry.raceDisplayName} | Circle {entry.circle}
                </button>
              ))}
            </div>
            {selectedRace ? (
              <section className="race-details">
                <h3>{selectedRace.name}</h3>
                <p className="subtle">{selectedRace.description ?? 'No description available.'}</p>
              </section>
            ) : null}
            <form onSubmit={rerollCharacter}>
              <label>
                <span>Reroll as race</span>
                <select value={rerollRace} onChange={(event) => setRerollRace(event.target.value)}>
                  <option value="">Same race</option>
                  {races.map((race) => <option key={race.id} value={race.name}>{race.name}</option>)}
                </select>
              </label>
              <button type="submit" disabled={loading || !character}>Reroll</button>
              <button type="button" onClick={() => void runRerollAllRaces()} disabled={loading || !character}>Reroll all races</button>
            </form>
          </article>

          <article className="panel">
            <h2>Scripts</h2>
            <div className="action-grid">
              {availableScriptPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setNewScriptName(preset.name);
                    setNewScriptDescription(preset.description);
                    setNewScriptCommands(preset.commands.join('\n'));
                  }}
                >
                  load {preset.name}
                </button>
              ))}
            </div>
            <form onSubmit={handleCreateScript}>
              <label>
                <span>Script name</span>
                <input value={newScriptName} onChange={(event) => setNewScriptName(event.target.value)} />
              </label>
              <label>
                <span>Description</span>
                <input value={newScriptDescription} onChange={(event) => setNewScriptDescription(event.target.value)} />
              </label>
              <label>
                <span>Commands</span>
                <textarea value={newScriptCommands} onChange={(event) => setNewScriptCommands(event.target.value)} rows={8} />
              </label>
              <label>
                <span>Pace ms</span>
                <input type="number" min="0" max="1000" value={scriptRunPaceMs} onChange={(event) => setScriptRunPaceMs(Math.max(0, Number(event.target.value || 0)))} />
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={continueOnScriptError} onChange={(event) => setContinueOnScriptError(event.target.checked)} />
                <span>Continue on command errors</span>
              </label>
              <button type="submit" disabled={loading}>Save Script</button>
            </form>
            {scripts.map((entry) => (
              <section className="script-item" key={entry.id}>
                <p>{entry.name} ({entry.commands.length} cmds)</p>
                <p className="subtle">{entry.description}</p>
                <button type="button" onClick={() => void runScript(entry)} disabled={loading || !character}>run</button>
                <button type="button" onClick={() => void deleteScript(entry.id)} disabled={loading}>delete</button>
              </section>
            ))}
          </article>

          <article className="panel">
            <h2>Routes</h2>
            <button type="button" onClick={runTourAllGuilds} disabled={loading || !character}>tour all guilds + shops</button>
            <div className="action-grid">
              {guildWalkRoute.map((route) => (
                <button type="button" key={route.id} onClick={() => void runQuickGuildVisit(route)} disabled={loading || !character}>
                  {route.label}
                </button>
              ))}
            </div>
            <h3>Known Shops</h3>
            <ul>
              {shops.map((entry) => <li key={entry.roomId}>{entry.shop.name} ({entry.roomId})</li>)}
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}

export { App, GameStatusPanels };
export type { Character, CharacterSkill, Room };
