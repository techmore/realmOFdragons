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

type RoomShopNpc = {
  name: string;
  role: string;
  dialogue: string[];
};

type ItemDetail = {
  code: string;
  name: string;
  category: string;
  description: string;
  value: number;
  currency: string;
  source: string;
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
  npc?: RoomShopNpc;
  stockRefresh?: string;
};

type RoomForage = {
  difficulty: number;
  items: Array<{
    code: string;
    name: string;
  }>;
};

type Room = {
  id: string;
  code: RoomCode;
  title: string;
  description: string;
  prompts: string[];
  exits: Exit[];
  guild?: string;
  shop?: RoomShop;
  forage?: RoomForage;
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
  ammoPouch?: Record<string, number>;
  loadedAmmo?: Record<string, string>;
  recoverableAmmo?: Record<string, number>;
  worn?: string[];
  equipment?: Record<string, string>;
  wallet: Wallet;
  combat?: CombatState;
  stance: 'balanced' | 'offensive' | 'defensive' | 'evasive';
  balance: number;
  stats: Stats;
  rollProfileVersion: number;
  statGenerationMode?: 'modern_fixed' | 'classic_random';
  roundtimeMs: number;
};

type CommandResult = {
  character: Character;
  room: Room;
  events: string[];
  targets: RoomTarget[];
  itemDetails: ItemDetail[];
};

type RoomTarget = {
  id: string;
  name: string;
  vitality: number;
  aggression: number;
};

type EnemyDeployment = {
  id: string;
  roomId: string;
  roomTitle: string;
  name: string;
  maxHp: number;
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
  fixedStartingStats?: Stats;
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
  itemDetails?: ItemDetail[];
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
  worldTargets?: EnemyDeployment[];
  itemDetails?: ItemDetail[];
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
  { id: 'moon_mage', label: 'Moon Mage', goto: 'nw', back: 'se' },
  { id: 'necromancer', label: 'Necromancer', goto: 'nw', back: 'se' },
  { id: 'paladin', label: 'Paladin', goto: 'e', back: 'w' },
  { id: 'ranger', label: 'Ranger', goto: 'se', back: 'nw' },
  { id: 'thief', label: 'Thief', goto: 'sw', back: 'ne' },
  { id: 'trader', label: 'Trader', goto: 'n', back: 's' },
  { id: 'warrior_mage', label: 'Warrior Mage', goto: 's', back: 'n' },
  { id: 'cleric', label: 'Cleric', goto: 'u', back: 'down' },
  { id: 'empath', label: 'Empath', goto: 'n', back: 's' },
];

const SHOP_STOCK_FALLBACK_REFRESH = 'static catalog; refreshed whenever the world fixture is reloaded';

function getShopNpcName(shop?: RoomShop) {
  return shop?.npc?.name ?? (shop ? `${shop.name} clerk` : 'no shopkeeper');
}

function getShopNpcRole(shop?: RoomShop) {
  return shop?.npc?.role ?? 'shopkeeper';
}

function getShopStockRefresh(shop?: RoomShop) {
  return shop?.stockRefresh ?? SHOP_STOCK_FALLBACK_REFRESH;
}

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

function formatStatGenerationMode(mode?: Character['statGenerationMode']): string {
  return mode === 'classic_random' ? 'Classic random roll' : 'Modern fixed racial stats';
}

function formatStatName(statName: string): string {
  return statName.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

const SHOP_SELL_RATE = 0.75;
const DAMAGED_AMMO_SELL_RATE = 0.25;
const DEFAULT_AMMO_BUNDLE_SIZE = 5;

type ShopSalePresentation = {
  displayName: string;
  bundleSize?: number;
  resaleEstimate?: number;
  sellHint: string;
  sellMatch?: RoomShopItem;
};

function localShopSellMatch(itemCode: string, room: Room | null): RoomShopItem | undefined {
  const catalogCode = itemCode.startsWith('damaged-') ? itemCode.replace(/^damaged-/, '') : itemCode;
  return room?.shop?.items.find((entry) => entry.code === catalogCode);
}

function estimateShopResale(code: string, match: RoomShopItem | undefined, bundleSize?: number, mode: 'carried' | 'ammoPouch' = 'carried'): number | undefined {
  if (!match) return undefined;
  if (mode === 'ammoPouch') {
    return Math.max(1, Math.floor((match.price / (bundleSize ?? DEFAULT_AMMO_BUNDLE_SIZE)) * SHOP_SELL_RATE));
  }
  if (code.startsWith('damaged-')) {
    return Math.max(1, Math.floor((match.price / (bundleSize ?? DEFAULT_AMMO_BUNDLE_SIZE)) * DAMAGED_AMMO_SELL_RATE));
  }
  return Math.max(1, Math.floor(match.price * SHOP_SELL_RATE));
}

function shopSalePresentation(code: string, room: Room | null, detail?: ItemDetail, mode: 'carried' | 'ammoPouch' = 'carried'): ShopSalePresentation {
  const sellMatch = localShopSellMatch(code, room);
  const bundleSize = detail?.bundleSize ?? (mode === 'ammoPouch' || code.startsWith('damaged-') ? DEFAULT_AMMO_BUNDLE_SIZE : undefined);
  const resaleEstimate = estimateShopResale(code, sellMatch, bundleSize, mode);
  const displayName = detail?.name ?? sellMatch?.name ?? code;
  const priceText = resaleEstimate && sellMatch ? `${resaleEstimate} ${sellMatch.currency}` : undefined;
  if (sellMatch && mode === 'ammoPouch') {
    return {
      displayName,
      bundleSize,
      resaleEstimate,
      sellMatch,
      sellHint: `${room?.shop?.name} buys ${sellMatch.name} from your ammo pouch${priceText ? ` for about ${priceText} each` : ''}.`,
    };
  }
  if (sellMatch && code.startsWith('damaged-')) {
    return {
      displayName,
      bundleSize,
      resaleEstimate,
      sellMatch,
      sellHint: `${room?.shop?.name} buys matching salvage${priceText ? ` for about ${priceText}` : ''}.`,
    };
  }
  if (sellMatch) {
    return {
      displayName,
      bundleSize,
      resaleEstimate,
      sellMatch,
      sellHint: `${room?.shop?.name} stocks this item and can buy it${priceText ? ` for about ${priceText}` : ''}.`,
    };
  }
  return {
    displayName,
    bundleSize,
    resaleEstimate,
    sellHint: room?.shop
      ? `${room.shop.name} does not stock ${mode === 'ammoPouch' ? code : 'this item'}.`
      : mode === 'ammoPouch'
        ? 'Selling ammo requires a local shop.'
        : 'Selling requires a local shop.',
  };
}

function GameStatusPanels({
  character,
  room,
  selectedCharacter,
  skillEntries,
  localTargets = [],
  worldTargets = [],
  itemDetails = [],
  loading = false,
  onCommand = () => undefined,
}: GameStatusPanelsProps) {
  const affordances = room
    ? [
        {
          label: 'Exits mapped',
          detail: room.exits.length ? room.exits.map((exit) => exit.direction).join(', ') : 'none',
          command: room.exits.length ? 'exits' : undefined,
        },
        {
          label: 'Forage available',
          detail: room.forage?.items.length
            ? `difficulty ${room.forage.difficulty}: ${room.forage.items.map((item) => item.name).join(', ')}`
            : 'nothing obvious',
          command: room.forage?.items.length ? 'forage' : undefined,
        },
        {
          label: 'Shop service',
          detail: room.shop ? `${room.shop.name} (${room.shop.items.length} items, ${getShopNpcName(room.shop)})` : 'none',
          command: room.shop ? 'shop' : undefined,
        },
        {
          label: 'Guild registrar',
          detail: room.guild ?? 'none',
          command: room.guild ? 'join guild' : undefined,
        },
        {
          label: 'Targets visible',
          detail: localTargets.length ? localTargets.map((target) => target.name).join(', ') : 'none',
          command: localTargets.length ? 'scan' : undefined,
        },
      ]
    : [];
  const sellingUnavailable = Boolean(character) && (!room || room.shop === undefined);

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
            <div className="affordance-panel">
              <h3>Room Affordances</h3>
              <p className="subtle">Structured survey summary from room state. No terminal parsing required.</p>
              <div className="affordance-list">
                {affordances.map((entry) => {
                  const command = entry.command;
                  return (
                    <div className="affordance-row" key={entry.label}>
                      <span>
                        <strong>{entry.label}</strong>
                        <small>{entry.detail}</small>
                      </span>
                      {command ? <code>{command}</code> : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {room.forage?.items.length ? (
              <div className="forage-panel">
                <h3>Forage</h3>
                <p className="subtle">Difficulty {room.forage.difficulty}. Try <code>forage</code> to search for {room.forage.items.map((item) => item.name).join(', ')}.</p>
              </div>
            ) : null}
            <h3>Exits</h3>
            <div className="exit-list">
              {room.exits.map((exit) => (
                <code key={exit.destination + exit.direction}>{exit.direction}</code>
              ))}
            </div>
            {room.shop ? (
              <>
                <h3>{room.shop.name}</h3>
                <p>NPC: {getShopNpcName(room.shop)} ({getShopNpcRole(room.shop)})</p>
                <p className="subtle">Stock refresh: {getShopStockRefresh(room.shop)}</p>
                <div className="action-grid">
                  <code>shop talk</code>
                  <code>shop stock</code>
                </div>
                <ul>
                  {room.shop.items.map((item) => (
                    <li key={item.code}>
                      <code>shop buy {item.code}</code>
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
        <div className="command-discovery">
          <p><strong>New here?</strong> Use <code>verb</code> for grouped commands, <code>help scan</code> for target discovery, and <code>target &lt;name&gt;</code> before you advance.</p>
          <p className="subtle">Gameplay is text-first: type commands at the prompt. The panels below are reference only.</p>
        </div>
        <div className="action-grid">
          {['look', 'survey', 'verb', 'scan', 'forage', 'score', 'skills', 'circle', 'balance', 'range', 'advance', 'retreat', 'jab', 'bash', 'stance balanced', 'stance offensive', 'stance defensive', 'stance evasive', 'train', 'train melee', 'inventory', 'ammo', 'reload', 'recover arrows', 'wield training sword', 'shop', 'shop talk', 'shop stock', 'join guild', 'combat', 'attack', 'fire', 'shoot', 'defend', 'flee', 'rest'].map((entry) => (
            <code key={entry}>{entry}</code>
          ))}
        </div>
        <div className="dpad-grid" role="group" aria-label="Directional movement controls">
          {directionButtons.map((button) => (
            <code
              key={button.command}
              className={button.command === 'exits' || button.command === 'look' ? 'dpad-wide' : ''}
              title={button.title}
            >
              {button.label}
            </code>
          ))}
        </div>
        {localTargets.length ? (
          <>
            <h3>Visible Targets</h3>
            <p className="subtle">Vitality estimates staying power; aggression estimates how quickly a target presses or attacks.</p>
            <div className="action-grid">
              {localTargets.map((target) => (
                <span key={target.id} className="target-actions">
                  <strong>{target.name}</strong>
                  <small>Vitality {target.vitality} · Aggression {target.aggression}</small>
                  <code>target {target.name}</code>
                  <code>advance {target.name}</code>
                  <code>attack {target.name}</code>
                </span>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <h2>Goal Verification</h2>
        <div className="verification-panel">
          <h3>Guild Circle 10 Verification</h3>
          <p className="subtle">
            {guildWalkRoute.length} canonical DragonRealms guilds tracked for in-world joining,
            circle requirements, perks, and Circle 10 smoke verification.
          </p>
          <p>Current guild: {character?.guildName ?? 'not joined'} · Circle {character?.circle ?? 0}/10</p>
        </div>
        <div className="verification-panel">
          <h3>Shop NPC Verification</h3>
          <p className="subtle">
            Shop NPC dialogue, stock refresh metadata, inventory, and transactions are covered for Crossing shops.
          </p>
          {room?.shop ? (
            <>
              <p>NPC: {getShopNpcName(room.shop)} ({getShopNpcRole(room.shop)})</p>
              <p>Stock refresh: {getShopStockRefresh(room.shop)}</p>
              <div className="action-grid">
                <code>shop talk</code>
                <code>shop stock</code>
              </div>
            </>
          ) : (
            <p>No shop NPC in this room.</p>
          )}
        </div>
        <div className="verification-panel">
          <h3>Enemy Deployment Verification</h3>
          <p className="subtle">
            {worldTargets.length} Crossing enemy deployments loaded from the world target catalog and verified by focused enemy smoke.
          </p>
          {worldTargets.length ? (
            <ul>
              {worldTargets.map((target) => (
                <li key={target.id}>
                  {target.name} in {target.roomTitle} · Vitality {target.maxHp} · Aggression {target.aggression}
                </li>
              ))}
            </ul>
          ) : (
            <p>No deployed enemy catalog loaded.</p>
          )}
        </div>
        <div className="verification-panel">
          <h3>Combat Readiness</h3>
          <p className="subtle">
            Combat smoke verifies scan, target detail, advance, range, melee attack, ranged reload/fire, recovery, stance, balance, and roundtime paths.
          </p>
          <p>Local targets visible: {localTargets.length ? localTargets.map((target) => target.name).join(', ') : 'none'}</p>
          <p>
            Engagement: {character?.combat
              ? `${character.combat.targetName} at ${character.combat.range} range, advantage ${character.combat.advantage}`
              : 'not engaged'}
          </p>
          <div className="action-grid">
            <code>scan</code>
            <code>range</code>
            <code>combat</code>
          </div>
        </div>
      </section>

      <section className="panel equip">
        <h2>Character</h2>
        <p>{selectedCharacter ? `${selectedCharacter.name} | ${selectedCharacter.raceDisplayName} | ${formatStatGenerationMode(selectedCharacter.statGenerationMode)}` : 'No character selected'}</p>
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
        <h3>Worn</h3>
        <p>{character?.worn?.length ? character.worn.join(', ') : 'nothing'}</p>
        <h3>Equipment Slots</h3>
        <div className="stat-grid">
          {Object.entries(character?.equipment ?? {}).length ? (
            Object.entries(character?.equipment ?? {}).map(([slot, item]) => (
              <span key={slot}>{slot}: {item}</span>
            ))
          ) : (
            <span>none</span>
          )}
        </div>
        <h3>Skills</h3>
        <ul>
          {skillEntries.map(([id, skill]) => (
            <li key={id}>{skill.name}: {skill.rank} ({skill.pool})</li>
          ))}
        </ul>
        <h3>Inventory</h3>
        {sellingUnavailable ? (
          <p className="subtle">Selling requires a local shop. Travel to a shop room before selling carried items.</p>
        ) : null}
        <h3>Ammo</h3>
        {Object.entries(character?.ammoPouch ?? {}).length ? (
          <ul className="ammo-pouch-list">
            {Object.entries(character?.ammoPouch ?? {}).map(([code, count]) => {
              const detail = itemDetails.find((entry) => entry.code === code);
              const sale = shopSalePresentation(code, room, detail, 'ammoPouch');
              return (
                <li key={code}>
                  <strong>{sale.displayName}</strong>
                  <span>{code} x{count}</span>
                  <small>
                    bundle {sale.bundleSize ?? 'unknown'} | resale estimate {sale.resaleEstimate && sale.sellMatch ? `${sale.resaleEstimate} ${sale.sellMatch.currency} each` : 'unavailable'}
                  </small>
                  <small>{sale.sellHint}</small>
                  <button
                    type="button"
                    onClick={() => onCommand(`shop sell ${code}`)}
                    disabled={loading || !character || !sale.sellMatch}
                    title={sale.sellHint}
                  >
                    sell one
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>none</p>
        )}
        <p>Loaded: {Object.entries(character?.loadedAmmo ?? {}).map(([weapon, ammo]) => `${weapon}: ${ammo}`).join(', ') || 'none'}</p>
        <p>Recoverable: {Object.entries(character?.recoverableAmmo ?? {}).map(([code, count]) => `${code} x${count}`).join(', ') || 'none'}</p>
        <ul>
          {(character?.inventory ?? []).map((item, index) => {
            const detail = itemDetails.find((entry) => entry.code === item);
            const sale = shopSalePresentation(item, room, detail, 'carried');
            return (
              <li key={`${item}-${index}`}>
                <span>{sale.displayName}</span>
                <small>{sale.sellHint}</small>
                <button type="button" onClick={() => onCommand(`appraise ${item}`)} disabled={loading || !character}>
                  appraise
                </button>
                <button
                  type="button"
                  onClick={() => onCommand(`shop sell ${item}`)}
                  disabled={loading || !character || !room?.shop}
                  title={sale.sellHint}
                >
                  sell
                </button>
              </li>
            );
          })}
        </ul>
        {itemDetails.length ? (
          <>
            <h3>Item Details</h3>
            <div className="item-detail-list">
              {itemDetails.map((item) => (
                <section className="item-detail" key={item.code}>
                  <strong>{item.name}</strong>
                  <small>{item.code} | {item.category} | {item.value} {item.currency}</small>
                  <small>slot {item.slot ?? 'held/carried'} | armor {item.armor} | evasion penalty {item.evasionPenalty} | attack {item.attackModifier}</small>
                  <small>weapon {item.weaponRange ?? 'none'} | ranges {item.validAttackRanges?.join(', ') ?? 'none'} | trains {item.trainingSkill ?? 'none'}</small>
                  <small>ammo {item.ammoName ? `${item.ammoName} (${item.ammoCode})` : 'none'}</small>
                  <small>quantity {item.quantity ?? 1} | bundle {item.bundleSize ?? 1}</small>
                  <p className="subtle">{item.description}</p>
                  <div className="action-grid">
                    <button type="button" onClick={() => onCommand(`appraise ${item.code}`)} disabled={loading || !character}>
                      appraise
                    </button>
                    {item.slot ? (
                      <button type="button" onClick={() => onCommand(`wear ${item.code}`)} disabled={loading || !character || item.carried === false}>
                        wear
                      </button>
                    ) : null}
                    {item.shopAvailable ? (
                      <button type="button" onClick={() => onCommand(`shop buy ${item.code}`)} disabled={loading || !character}>
                        buy
                      </button>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : null}
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
  const [worldTargets, setWorldTargets] = useState<EnemyDeployment[]>([]);
  const [itemDetails, setItemDetails] = useState<ItemDetail[]>([]);
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
    const [raceData, guildData, shopData, roomData, targetData] = await Promise.all([
      request<{ races: Race[] }>('/races', { token: accessToken }),
      request<{ guilds: Guild[] }>('/world/guilds', { token: accessToken }),
      request<{ shops: ShopSummary[] }>('/world/shops', { token: accessToken }),
      request<{ rooms: Room[] }>('/world/rooms', { token: accessToken }),
      request<{ targets: EnemyDeployment[] }>('/world/targets?town=crossing', { token: accessToken }),
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
        fixedStartingStats: entry.fixedStartingStats,
      })),
    );
    setGuilds(guildData.guilds);
    setShops(shopData.shops);
    setWorldTargets(targetData.targets);
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
    const data = await request<{ character: Character; room: Room; targets: RoomTarget[]; itemDetails: ItemDetail[] }>(`/characters/${characterId}/state`, {
      token: accessToken,
    });
    setSelectedCharacterId(characterId);
    setCharacter(data.character);
    setRoom(data.room);
    setLocalTargets(data.targets);
    setItemDetails(data.itemDetails ?? []);
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
          statMode: 'modern_fixed',
        },
      });
      appendHistory(`Created ${payload.name} (${payload.raceDisplayName} / ${formatStatGenerationMode(payload.statGenerationMode)}).`);
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
    if (trimmed === 'ui guild tour') {
      appendHistory(`> ${trimmed}`);
      await runTourAllGuilds();
      return;
    }
    if (trimmed === 'ui enemy loop') {
      appendHistory(`> ${trimmed}`);
      await runEnemyDeploymentLoop();
      return;
    }
    if (trimmed === 'ui combat verify') {
      appendHistory(`> ${trimmed}`);
      await startManualCombatVerification();
      return;
    }
    if (trimmed === 'ui combat drill') {
      appendHistory(`> ${trimmed}`);
      await runSafeCombatDrill();
      return;
    }
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
    setItemDetails(result.itemDetails ?? []);
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

  const runEnemyDeploymentLoop = async () => {
    if (!character) return;
    setLoading(true);
    if (!Object.keys(worldRooms).length) {
      appendHistory('World map unavailable. Reload login and try again.');
      setLoading(false);
      return;
    }
    if (!worldTargets.length) {
      appendHistory('No Crossing enemy deployments loaded.');
      setLoading(false);
      return;
    }
    appendHistory(`Starting Crossing enemy deployment loop across ${worldTargets.length} rooms...`);
    try {
      let cursorRoomId = character.roomId;
      for (const target of worldTargets) {
        if (target.roomId !== cursorRoomId) {
          const commands = findPathBetweenRooms(worldRooms, cursorRoomId, target.roomId);
          if (!commands.length) {
            appendHistory(`No route available to ${target.name} in ${target.roomTitle}. Skipping.`);
            continue;
          }
          appendHistory(`→ ${target.roomTitle}: ${target.name}`);
          await runCommandSequence(commands);
          cursorRoomId = target.roomId;
        } else {
          appendHistory(`At target room: ${target.roomTitle}: ${target.name}`);
        }
        const scanResult = await executeCommand('scan');
        applyCommandResult(scanResult);
        const detailResult = await executeCommand(`target ${target.name}`);
        applyCommandResult(detailResult);
        const appraisalResult = await executeCommand(`appraise ${target.name}`);
        applyCommandResult(appraisalResult);
      }
      appendHistory('Enemy deployment loop complete: scanned and inspected all loaded Crossing targets.');
    } catch (error) {
      appendHistory(`Enemy deployment loop failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const startManualCombatVerification = async () => {
    if (!character) return;
    setLoading(true);
    if (!Object.keys(worldRooms).length) {
      appendHistory('World map unavailable. Reload login and try again.');
      setLoading(false);
      return;
    }
    const target = localTargets[0] ?? worldTargets[0];
    if (!target) {
      appendHistory('No local or catalog enemy target is available for manual combat verification.');
      setLoading(false);
      return;
    }
    appendHistory(`Starting manual combat verification with ${target.name}.`);
    try {
      const deploymentTarget = target as Partial<EnemyDeployment>;
      if (typeof deploymentTarget.roomId === 'string' && deploymentTarget.roomId !== character.roomId) {
        const commands = findPathBetweenRooms(worldRooms, character.roomId, deploymentTarget.roomId);
        if (!commands.length) {
          appendHistory(`No route available to ${target.name}.`);
          return;
        }
        await runCommandSequence(commands);
      }
      const scanResult = await executeCommand('scan');
      applyCommandResult(scanResult);
      const targetResult = await executeCommand(`target ${target.name}`);
      applyCommandResult(targetResult);
      const advanceResult = await executeCommand(`advance ${target.name}`);
      applyCommandResult(advanceResult);
      appendHistory('Manual combat verification ready: use range, combat, jab, bash, attack, or retreat.');
    } catch (error) {
      appendHistory(`Manual combat verification failed: ${formatTokenError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const runSafeCombatDrill = async () => {
    if (!character) return;
    setLoading(true);
    if (!Object.keys(worldRooms).length) {
      appendHistory('World map unavailable. Reload login and try again.');
      setLoading(false);
      return;
    }
    const target = worldTargets[0] ?? localTargets[0];
    if (!target) {
      appendHistory('No enemy target is available for safe combat drill.');
      setLoading(false);
      return;
    }
    appendHistory(`Starting safe combat drill with ${target.name}: route, scan, engage, status, retreat, recover.`);
    try {
      const deploymentTarget = target as Partial<EnemyDeployment>;
      if (typeof deploymentTarget.roomId === 'string' && deploymentTarget.roomId !== character.roomId) {
        const commands = findPathBetweenRooms(worldRooms, character.roomId, deploymentTarget.roomId);
        if (!commands.length) {
          appendHistory(`No route available to ${target.name}.`);
          return;
        }
        await runCommandSequence(commands);
      }
      appendHistory('[drill] checkpoint: target room reached.');
      await runCommandSequence([
        'look',
        'scan',
        `target ${target.name}`,
        `advance ${target.name}`,
        'range',
        'combat',
        'retreat',
        'recover arrows',
        'combat',
      ]);
      appendHistory('[drill] complete: retreated, recovered available ammunition, and captured final combat status.');
    } catch (error) {
      appendHistory(`Safe combat drill failed: ${formatTokenError(error)}`);
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
      setItemDetails(result.itemDetails ?? []);
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
        `Rerolled ${result.name}: ${result.raceDisplayName} / ${formatStatGenerationMode(result.statGenerationMode)} (trace v${result.rollProfileVersion}).`,
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
        appendHistory(`As ${result.raceDisplayName}: ${formatStatGenerationMode(result.statGenerationMode)} => STR ${result.stats.strength}, DIS ${result.stats.discipline}`);
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
            <span>{character ? formatStatGenerationMode(character.statGenerationMode) : 'Stats --'}</span>
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
              worldTargets={worldTargets}
              itemDetails={itemDetails}
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
              <p className="subtle">Creation uses DragonRealms modern fixed racial starting stats.</p>
              <p className="subtle">Guilds are joined in-world: travel to a guild registrar, then use <code>join guild</code>.</p>
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
                <p><strong>Starting stats:</strong> modern fixed DragonRealms racial table.</p>
                {selectedRace.fixedStartingStats ? (
                  <div className="stat-grid compact-stats">
                    {Object.entries(selectedRace.fixedStartingStats).map(([statName, value]) => (
                      <span key={statName}>{formatStatName(statName)}: {value}</span>
                    ))}
                  </div>
                ) : null}
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
            <p className="subtle">Scripts are reusable command macros. Load a preset, edit the command list, save it, then run it on the selected character.</p>
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
            <p className="subtle">Type these helper commands at the prompt; do not click gameplay actions.</p>
            <div className="action-grid">
              <code>ui guild tour</code>
              <code>ui enemy loop</code>
              <code>ui combat verify</code>
              <code>ui combat drill</code>
            </div>
            <div className="action-grid">
              {guildWalkRoute.map((route) => (
                <code key={route.id}>go {route.label.toLowerCase().replace(/\s+/g, '-')}</code>
              ))}
            </div>
            <h3>Known Enemies</h3>
            <ul>
              {worldTargets.map((target) => (
                <li key={target.id}>{target.name} ({target.roomTitle}, {target.roomId})</li>
              ))}
            </ul>
            <h3>Known Shops</h3>
            <ul>
              {shops.map((entry) => <li key={entry.roomId}>{entry.shop.name} ({getShopNpcName(entry.shop)}, {entry.roomId})</li>)}
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}

export { App, GameStatusPanels, shopSalePresentation };
export type { Character, CharacterSkill, ItemDetail, Room, ShopSalePresentation };
