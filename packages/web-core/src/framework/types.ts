export const APPLICATION_NAME = 'applicationName' as const;
export const APPLICATION_ID = 'applicationId' as const;
export const WINDOW_ID = 'windowId' as const;
export const ROOT_WORKER = 'remoteWorker' as const;
export const CONTAINER = 'container' as const;
export const STOP_SIGNAL = 'stopSignal' as const;

export type ICreationResult<T extends object> =
  | {
  status: 'ok';
  data: T;
}
  | {
  status: 'error';
  errors: Record<keyof T, string[]>;
};
