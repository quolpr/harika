declare module 'react-timeago' {
  const TimeAgo = (props: { date: Date }) => string;

  export default TimeAgo;
}

declare module 'remotedev' {
  export const connectViaExtension = (opts: { name: string }) => any;
}

declare module 'pouchdb-adapter-indexeddb' {
  declare let plugin: any;

  export default plugin;
}

declare module 'pouchdb-debug' {
  declare let plugin: any;

  export default plugin;
}

declare module 'pouchdb-adapter-http' {
  declare let plugin: any;

  export default plugin;
}
