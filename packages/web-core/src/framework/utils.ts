type Class<T = any> = new (...args: any[]) => T;
export const toRemoteName = (klass: Class) => {
  if (!('remoteName' in klass)) {
    throw new Error(
      `Did you forget to apply @remotable decorator to ${klass.name}?`,
    );
  }

  return `remote.${(klass as any).remoteName}`;
};

export const remotable = (name: string) => {
  return (constructor: Function) => {
    (constructor as any).remoteName = name;
  };
};
