import { SyncOptions, PouchDB } from 'rxdb';

export const configureSync = ({
  db,
  token,
  firstTime,
}: {
  db: string;
  firstTime: boolean;
  token: string;
}): SyncOptions => {
  const waitForLeadership = firstTime ? false : true;
  const live = firstTime ? false : true;

  return {
    remote: `https://app-dev.harika.io/db/${db}`,
    waitForLeadership,
    options: {
      live,
      retry: true,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      fetch: (url, opts) =>
        PouchDB.fetch(url, {
          ...opts,
          headers: {
            ...opts.headers,
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }),
    },
  };
};
