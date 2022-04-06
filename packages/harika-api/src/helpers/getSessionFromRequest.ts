import axios from 'axios';
import { IncomingMessage } from 'http';

import { oryClient } from '../oryClient';

export class UnauthorizedError extends Error {}

export const getSessionFromRequestStrict = async (req: IncomingMessage) => {
  if (!req.headers.cookie) {
    throw new UnauthorizedError();
  }

  try {
    return (await oryClient.toSession(undefined, req.headers?.cookie)).data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      throw new UnauthorizedError();
    }

    throw e;
  }
};
