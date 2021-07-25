import { Token } from './types';

export function parse(
  data: string,
  options: { generateId: () => string },
): Token[];
