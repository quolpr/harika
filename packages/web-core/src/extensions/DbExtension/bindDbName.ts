import { Container } from 'inversify';

import { APPLICATION_ID,APPLICATION_NAME } from '../../framework/types';
import { DB_NAME } from './types';

export const bindDbName = (container: Container) => {
  container
    .bind(DB_NAME)
    .toConstantValue(
      `${container.get(APPLICATION_NAME)}_${container.get(APPLICATION_ID)}`,
    );
};
