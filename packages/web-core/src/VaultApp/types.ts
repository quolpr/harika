export type ICreationResult<T extends object> =
  | {
      status: 'ok';
      data: T;
    }
  | {
      status: 'error';
      errors: Record<keyof T, string[]>;
    };
