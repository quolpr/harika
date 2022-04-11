import { Configuration, V0alpha2Api } from '@ory/client';

export const oryClient = new V0alpha2Api(
  new Configuration({
    basePath: import.meta.env.VITE_PUBLIC_AUTH_URL as string,
    baseOptions: {
      credentials: 'include',
      withCredentials: true,
    },
  }),
);
