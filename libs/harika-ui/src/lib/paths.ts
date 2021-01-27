import { camelCase } from 'lodash-es';
import { compile } from 'path-to-regexp';

const VAULT_INDEX_PATH = '/vaults';

export const PATHS = {
  VAULT_INDEX_PATH: VAULT_INDEX_PATH,

  VAULT_DAILY_PATH: '/vaults/:vaultId',
  VAULT_NOTE_INDEX_PATH: '/vaults/:vaultId/notes',
  VAULT_NOTE_PATH: '/vaults/:vaultId/notes/:noteId',
  SIGNUP_PATH: '/signup',
  LOGIN_PATH: '/login',

  DEFAULT_PATH: VAULT_INDEX_PATH,
} as const;

export const paths = (Object.fromEntries(
  Object.entries(PATHS).map(([key, value]) => [camelCase(key), compile(value)])
) as unknown) as {
  vaultIndexPath(): string;
  vaultDailyPath(params: { vaultId: string }): string;
  vaultNoteIndexPath(params: { vaultId: string }): string;
  vaultNotePath(params: { vaultId: string; noteId: string }): string;
  signupPath(): string;
  loginPath(): string;
  defaultPath(): string;
};
