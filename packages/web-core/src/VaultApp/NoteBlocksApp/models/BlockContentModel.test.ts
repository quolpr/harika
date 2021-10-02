import { expect } from '@esm-bundle/chai';
import { BlockContentModel } from './BlockContentModel';

describe('BlockContentModel', () => {
  describe('firstTodoId', () => {
    it('return first todo id', () => {
      const model = new BlockContentModel({
        _value: '[[TODO]] other [[TODO]]',
      });

      expect(model.firstTodoToken).to.be.a('object');
    });

    it('works with whitespaces at first', () => {
      const model = new BlockContentModel({ _value: '   [[TODO]]' });

      expect(model.firstTodoToken).to.be.a('object');
    });

    it('returns undefined when no first todo', () => {
      const model = new BlockContentModel({ _value: 'kek   [[TODO]]' });

      expect(model.firstTodoToken).to.eq(undefined);
    });
  });
});
