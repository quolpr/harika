export const liveQuery = (db: Dexie, table: string) => {
  return new Observable((observer) => {
    // TODO: how to usubscribe?

    db.on('changes', (changes) => {
      for (const change of changes) {
        if (change.table === table) {
          observer.next();
          return;
        }
      }
    });
  });
};
