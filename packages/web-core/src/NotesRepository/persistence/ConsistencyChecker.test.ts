describe('ConsistencyChecker', () => {
  context('when some of noteBlockIds not exists', () => {
    it('deletes it', () => {});
  });
  context('when some of noteIds not exists', () => {
    it('deletes it', () => {});
  });
  context('when parent block id is note exists', () => {
    it('puts block to conflicted root block', () => {});
  });

  it('fix ordering of noteBlockIds', () => {});

  it('fixes noteBlockIds/linkedNoteIds based on maps', () => {});
});
