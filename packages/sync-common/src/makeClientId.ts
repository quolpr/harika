import { v4 } from 'uuid';

export function makeClientId() {
  return v4().replace(/-/g, '').slice(-16);
}
