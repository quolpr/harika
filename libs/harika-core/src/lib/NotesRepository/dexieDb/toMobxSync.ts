import { NotesRepository, VaultModel } from '../../NotesRepository';
import { VaultDexieDatabase } from './DexieDb';

export const toMobxSync = (
  db: VaultDexieDatabase,

  noteRepository: NotesRepository,
  vault: VaultModel
) => {
  db.on('changes', (...args) => {
    console.log(args);
  });
};
