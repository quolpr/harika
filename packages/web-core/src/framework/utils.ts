type Class<T = any> = new (...args: any[]) => T;
export const toRemoteName = (klass: Class) => {
  return `remote.${klass.name}`;
};
