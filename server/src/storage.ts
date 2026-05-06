import { readFile, rename, writeFile } from 'node:fs/promises';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RoomId } from './world.js';
import type { StatBlock } from './races.js';

export type CombatRange = 'missile' | 'pole' | 'melee';

interface CombatState {
  targetId: string;
  targetName: string;
  targetHp: number;
  targetMaxHp: number;
  defendUntil: number;
  nextAttackAt: number;
  range: CombatRange;
  advantage: number;
}

export type CombatStance = 'balanced' | 'offensive' | 'defensive' | 'evasive';
export type BalanceLevel = 0 | 1 | 2 | 3 | 4;
export type EquipmentSlot = 'back' | 'hands' | 'body' | 'belt' | 'head' | 'feet';

export type EquipmentSlots = Partial<Record<EquipmentSlot, string>>;

interface HealthState {
  current: number;
  max: number;
}

export interface CurrencyWallet {
  plat: number;
  trias: number;
  lucan: number;
  silk: number;
}

export interface SkillState {
  name: string;
  rank: number;
  pool: number;
}

export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface CharacterRecord {
  id: string;
  accountId: string;
  name: string;
  race: string;
  raceDisplayName: string;
  role: string;
  roleTitle: string;
  guildId: string;
  guildName: string;
  circle: number;
  skills: Record<string, SkillState>;
  roomId: RoomId;
  stats: StatBlock;
  health: HealthState;
  wallet: CurrencyWallet;
  rollTrace: string[];
  rollProfileVersion: number;
  createdAt: string;
  inventory: string[];
  ammoPouch?: Record<string, number>;
  worn?: string[];
  equipment?: EquipmentSlots;
  hands: {
    left: string | null;
    right: string | null;
  };
  actionCooldownUntil?: number;
  combat?: CombatState;
  stance: CombatStance;
  balance: BalanceLevel;
  roundtimeMs: number;
}

export interface ScriptRecord {
  id: string;
  accountId: string;
  name: string;
  description?: string;
  commands: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginSession {
  refreshToken: string;
  accountId: string;
  tokenId: string;
  expiresAt: number;
  characterId?: string;
}

interface AccountsFile {
  schemaVersion: number;
  accounts: AccountRecord[];
}

interface CharactersFile {
  schemaVersion: number;
  characters: CharacterRecord[];
}

interface ScriptsFile {
  schemaVersion: number;
  scripts: ScriptRecord[];
}

interface SessionsFile {
  schemaVersion: number;
  sessions: LoginSession[];
}

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export class FileStorage {
  private accountsById = new Map<string, AccountRecord>();
  private accountsByEmail = new Map<string, AccountRecord>();
  private characters = new Map<string, CharacterRecord>();
  private scripts = new Map<string, ScriptRecord>();
  private refreshSessions = new Map<string, LoginSession>();
  private writeGuards = new Map<string, Promise<void>>();

  private filePath(fileName: string): string {
    return resolve(DATA_DIR, fileName);
  }

  async init(): Promise<void> {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    const accounts = await this.readAccountsFile();
    const characters = await this.readCharactersFile();
    const scripts = await this.readScriptsFile();
    const sessions = await this.readSessionsFile();

    this.accountsById = new Map(accounts.map((entry) => [entry.id, entry]));
    this.accountsByEmail = new Map(accounts.map((entry) => [entry.email.toLowerCase(), entry]));
    this.characters = new Map(characters.map((entry) => [entry.id, entry]));
    this.scripts = new Map(scripts.map((entry) => [entry.id, entry]));
    this.refreshSessions = new Map(sessions.map((entry) => [entry.refreshToken, entry]));
  }

  async getAccountByEmail(email: string): Promise<AccountRecord | undefined> {
    return this.accountsByEmail.get(email.toLowerCase());
  }

  async getAccountById(accountId: string): Promise<AccountRecord | undefined> {
    return this.accountsById.get(accountId);
  }

  async saveAccount(account: AccountRecord): Promise<void> {
    this.accountsById.set(account.id, account);
    this.accountsByEmail.set(account.email.toLowerCase(), account);
    await this.persistAccounts();
  }

  async listCharactersForAccount(accountId: string): Promise<CharacterRecord[]> {
    const all = [...this.characters.values()];
    return all.filter((entry) => entry.accountId === accountId);
  }

  async getCharacter(characterId: string): Promise<CharacterRecord | undefined> {
    return this.characters.get(characterId);
  }

  async saveCharacter(character: CharacterRecord): Promise<void> {
    this.characters.set(character.id, character);
    await this.persistCharacters();
  }

  async listScriptsForAccount(accountId: string): Promise<ScriptRecord[]> {
    const all = [...this.scripts.values()];
    return all.filter((entry) => entry.accountId === accountId);
  }

  async getScript(scriptId: string): Promise<ScriptRecord | undefined> {
    return this.scripts.get(scriptId);
  }

  async saveScript(script: ScriptRecord): Promise<void> {
    this.scripts.set(script.id, script);
    await this.persistScripts();
  }

  async deleteScript(scriptId: string): Promise<boolean> {
    const deleted = this.scripts.delete(scriptId);
    if (deleted) {
      await this.persistScripts();
    }
    return deleted;
  }

  async getRefreshSession(token: string): Promise<LoginSession | undefined> {
    return this.refreshSessions.get(token);
  }

  async saveRefreshSession(session: LoginSession): Promise<void> {
    this.refreshSessions.set(session.refreshToken, session);
    await this.persistSessions();
  }

  async deleteRefreshSession(token: string): Promise<void> {
    this.refreshSessions.delete(token);
    await this.persistSessions();
  }

  private async withFileLock(fileName: string, task: () => Promise<void>): Promise<void> {
    const prior = this.writeGuards.get(fileName) ?? Promise.resolve();
    const next = prior
      .catch(() => {})
      .then(task)
      .finally(() => {
        if (this.writeGuards.get(fileName) === next) {
          this.writeGuards.delete(fileName);
        }
      });
    this.writeGuards.set(fileName, next);
    await next;
  }

  private async persistAccounts(): Promise<void> {
    await this.withFileLock('accounts.json', async () => {
      const payload: AccountsFile = {
        schemaVersion: 1,
        accounts: [...this.accountsById.values()],
      };
      await this.writeAtomic(this.filePath('accounts.json'), payload);
    });
  }

  private async persistCharacters(): Promise<void> {
    await this.withFileLock('characters.json', async () => {
      const payload: CharactersFile = {
        schemaVersion: 1,
        characters: [...this.characters.values()],
      };
      await this.writeAtomic(this.filePath('characters.json'), payload);
    });
  }

  private async persistScripts(): Promise<void> {
    await this.withFileLock('scripts.json', async () => {
      const payload: ScriptsFile = {
        schemaVersion: 1,
        scripts: [...this.scripts.values()],
      };
      await this.writeAtomic(this.filePath('scripts.json'), payload);
    });
  }

  private async persistSessions(): Promise<void> {
    await this.withFileLock('sessions.json', async () => {
      const payload: SessionsFile = {
        schemaVersion: 1,
        sessions: [...this.refreshSessions.values()],
      };
      await this.writeAtomic(this.filePath('sessions.json'), payload);
    });
  }

  private async readAccountsFile(): Promise<AccountRecord[]> {
    const data = await this.readJsonFile<AccountsFile>(this.filePath('accounts.json'), {
      schemaVersion: 1,
      accounts: [],
    });
    if (!Array.isArray(data.accounts)) return [];
    return data.accounts;
  }

  private async readCharactersFile(): Promise<CharacterRecord[]> {
    const data = await this.readJsonFile<CharactersFile>(this.filePath('characters.json'), {
      schemaVersion: 1,
      characters: [],
    });
    if (!Array.isArray(data.characters)) return [];
    return data.characters;
  }

  private async readScriptsFile(): Promise<ScriptRecord[]> {
    const data = await this.readJsonFile<ScriptsFile>(this.filePath('scripts.json'), {
      schemaVersion: 1,
      scripts: [],
    });
    if (!Array.isArray(data.scripts)) return [];
    return data.scripts;
  }

  private async readSessionsFile(): Promise<LoginSession[]> {
    const data = await this.readJsonFile<SessionsFile>(this.filePath('sessions.json'), {
      schemaVersion: 1,
      sessions: [],
    });
    if (!Array.isArray(data.sessions)) return [];
    return data.sessions;
  }

  private async writeAtomic(path: string, payload: unknown): Promise<void> {
    const tmp = `${path}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
    await rename(tmp, path);
  }

  private async readJsonFile<T>(path: string, fallback: T): Promise<T> {
    try {
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return fallback;
      }
      return fallback;
    }
  }
}
