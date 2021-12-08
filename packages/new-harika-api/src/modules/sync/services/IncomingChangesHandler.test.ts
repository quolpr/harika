import {
  updateChangeFactory,
  createChangeFactory,
  makeClientId,
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

  it('works', async () => {
    // console.log(
    //   await createChangeFactory.create(
    //     { obj: { id: '123', content: 'test' } },
    //     { transient: { schemaName } }
    //   )
    // );

    await incomingChangesHandler.handleIncomeChanges(
      schemaName,
      makeClientId(),
      [
        createChangeFactory.build({ doc: { id: '123', content: 'test' } }),
        updateChangeFactory.build({
          docId: '123',
          from: { content: 'wow' },
          to: { childIds: [1, 2, 3], test: true },
        }),
      ]
    );

    console.log('hex3!');
  });
});
