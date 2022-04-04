import { Configuration, V0alpha2Api } from '@ory/client';

export const oryClient = new V0alpha2Api(
  new Configuration({
    basePath: 'http://localhost:5001/auth',
    baseOptions: {
      credentials: 'include',
      withCredentials: true,
    },
  }),
);
