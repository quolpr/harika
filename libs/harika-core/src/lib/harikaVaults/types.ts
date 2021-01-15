// eslint-disable-next-line @typescript-eslint/ban-types
export type ICreationResult<T extends object> =
  | {
      status: 'ok';
      data: T;
    }
  | {
      status: 'error';
      errors: Record<keyof T, string[]>;
    };
