import { Container } from 'inversify';
import { APPLICATION_NAME, APPLICATION_ID } from '../../framework/types';
import { DB_NAME } from './types';

export const bindDbName = (container: Container) => {
  container
    .bind(DB_NAME)
    .toConstantValue(
      `${container.get(APPLICATION_NAME)}_${container.get(APPLICATION_ID)}`,
    );
};
