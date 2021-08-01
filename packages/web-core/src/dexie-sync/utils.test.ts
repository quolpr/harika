import { expect } from 'chai';
import { getObjectDiff } from './utils';

describe('getObjectDiff', () => {
  it('diffs object', () => {
    expect(
      getObjectDiff({ iam: true, boss: true }, { iam: true, boss: false }),
    ).to.deep.eq({
      from: {
        boss: true,
      },
      to: {
        boss: false,
      },
    });
  });

  describe('nested array/object', () => {
    it('checks with deep equal', () => {
      expect(
        getObjectDiff(
          {
            array: [123],
            obj: { test: true },
            arr2: [345],
            obj2: { wow: true },
          },
          {
            array: [123],
            obj: { test: true },
            arr2: [3456],
            obj2: { wow: false },
          },
        ),
      ).to.deep.eq({
        from: {
          arr2: [345],
          obj2: { wow: true },
        },
        to: {
          arr2: [3456],
          obj2: { wow: false },
        },
      });
    });
  });

  it('includes if key not present in second object', () => {
    expect(
      getObjectDiff(
        {
          iam: true,
          boss: true,
        },
        { boss: false },
      ),
    ).to.deep.eq({
      from: { iam: true, boss: true },
      to: { boss: false },
    });
  });

  it('adds new key if not present in first object', () => {
    expect(
      getObjectDiff(
        {
          boss: true,
        },
        { boss: false, iam: true },
      ),
    ).to.deep.eq({
      from: {
        boss: true,
      },
      to: { iam: true, boss: false },
    });
  });

  it('handles undefined', () => {
    expect(
      getObjectDiff(
        {
          boss: undefined,
        },
        { boss: 2 },
      ),
    ).to.deep.eq({ from: { boss: undefined }, to: { boss: 2 } });

    expect(
      getObjectDiff(
        {
          boss: 2,
        },
        { boss: undefined },
      ),
    ).to.deep.eq({ from: { boss: 2 }, to: { boss: undefined } });

    expect(
      getObjectDiff(
        {
          boss: undefined,
        },
        { boss: undefined },
      ),
    ).to.deep.eq({ from: {}, to: {} });
  });
});
