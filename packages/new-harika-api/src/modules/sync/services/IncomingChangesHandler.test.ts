import {
  buildCreateChange,
  buildUpdateChange,
} from '../../../../test/supports/changeBuilders';
import {
  createTestDbSchema,
  dropTestDbSchema,
} from '../../../../test/supports/createDbSchema';
import { pg } from '../../../plugins/db';
import { IncomingChangesHandler } from './IncomingChangesHandler';

describe('IncomingChangesHandler', () => {
  let schemaName!: string;

  let incomingChangesHandler = new IncomingChangesHandler(pg);

  beforeEach(async () => {
    schemaName = await createTestDbSchema();
  });

  afterEach(async () => {
    await dropTestDbSchema(schemaName);
  });

  it('works', () => {
    incomingChangesHandler.handleIncomeChanges(schemaName, [
      buildCreateChange('wow', { id: '123', content: 'test' }),
      buildUpdateChange(
        'wow',
        '123',
        { content: 'wow' },
        { childIds: [1, 2, 3], test: true }
      ),
    ]);

    console.log('hex!');
  });
});
