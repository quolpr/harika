import { Configuration } from '@ory/client';
import { V0alpha2Api } from '@ory/kratos-client';

export const oryClient = new V0alpha2Api(
  new Configuration({ basePath: 'http://localhost:4433' })
);
