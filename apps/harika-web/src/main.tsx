import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import DatabaseProvider from '@nozbe/watermelondb/DatabaseProvider';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { App } from './app/app';
import { noteSchema, Note, NoteBlock } from '@harika/harika-notes';

const adapter = new LokiJSAdapter({
  schema: noteSchema,
  // migrations, // optional migrations
  useWebWorker: false, // recommended for new projects. tends to improve performance and reduce glitches in most cases, but also has downsides - test with and without it
  useIncrementalIndexedDB: true, // recommended for new projects. improves performance (but incompatible with early Watermelon databases)
  // dbName: 'myapp', // optional db name
  // It's recommended you implement this method:
  // onIndexedDBVersionChange: () => {
  //   // database was deleted in another browser tab (user logged out), so we must make sure we delete
  //   // it in this tab as well
  //   if (checkIfUserIsLoggedIn()) {
  //     window.location.reload()
  //   }
  // },
  // Optional:
  // onQuotaExceededError: (error) => { /* do something when user runs out of disk space */ },
} as any);

// Then, make a Watermelon database from it!
const database = new Database({
  adapter,
  modelClasses: [Note, NoteBlock],
  actionsEnabled: true,
});

const Test: React.FC = ({ children }) => {
  const database = useDatabase();

  useEffect(() => {
    database.action(async () => {
      const notesCollection = database.collections.get<Note>('notes');
      const blocksCollection = database.collections.get<NoteBlock>(
        'note_blocks'
      );

      const noteM = await notesCollection.create((note: Note) => {
        note.title = 'hey';
      });

      const block = await blocksCollection.create((blockM: NoteBlock) => {
        blockM.content = 'heyy!';
        blockM.note_id = noteM.id;
        blockM.order = 0;
      });

      await blocksCollection.create((blockM: NoteBlock) => {
        blockM.content = 'heyy2!';
        blockM.note_id = noteM.id;
        blockM.parent_block_id = block.id;
        blockM.order = 0;
      });

      const indentedBlock = await blocksCollection.create(
        (blockM: NoteBlock) => {
          blockM.content = 'heyy2!';
          blockM.note_id = noteM.id;
          blockM.parent_block_id = block.id;
          blockM.order = 1;
        }
      );

      await blocksCollection.create((blockM: NoteBlock) => {
        blockM.content = 'heyy3!';
        blockM.note_id = noteM.id;
        blockM.parent_block_id = indentedBlock.id;
        blockM.order = 0;
      });

      await blocksCollection.create((blockM: NoteBlock) => {
        blockM.content = 'heyy2!';
        blockM.note_id = noteM.id;
        blockM.parent_block_id = block.id;
        blockM.order = 2;
      });
    });
  }, [database]);

  return <>{children}</>;
};

ReactDOM.render(
  <DatabaseProvider database={database}>
    <Test>
      <App />
    </Test>
  </DatabaseProvider>,
  document.getElementById('root')
);
