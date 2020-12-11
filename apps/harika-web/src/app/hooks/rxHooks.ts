import { DbCollections } from '../initDb';

export const useHarikaRxData = <T extends keyof DbCollections, K>(
  collection: T
) => {};
