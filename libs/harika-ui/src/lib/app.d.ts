declare module 'react-timeago' {
  const TimeAgo = (props: { date: Date }) => string;

  export default TimeAgo;
}

declare module 'remotedev' {
  export const connectViaExtension = (opts: { name: string }) => any;
}
