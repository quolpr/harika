import { createChangeFactory } from '../../../../test/supports/changeBuilders';
import { ChangesSelectorForSnapshot } from './ChangesSelectorForSnapshot';
import { IChangesService } from './changesService';

describe('ChangesSelectorForSnapshot', () => {
  const changesService: jest.Mocked<IChangesService> = {
    getChangesAfterOrEqualClock: jest.fn(),
    // TODO: typing missed, not sure how to fix constructor typing issue
  };

  it('works', () => {
    changesService.getChangesAfterOrEqualClock.mockResolvedValueOnce(
      Promise.resolve([createChangeFactory.build()])
    );

    const selector = new ChangesSelectorForSnapshot(changesService);

    selector.getChangesForChanges([createChangeFactory.build()]);
  });
});
