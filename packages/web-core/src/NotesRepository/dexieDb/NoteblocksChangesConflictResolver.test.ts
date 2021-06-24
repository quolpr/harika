describe('NoteblocksChangesConflictResolver', () => {
  describe('resolveConflicts', () => {
    describe('when update <-> update', () => {
      context('when parentBlockId conflicted', () => {
        it('takes server change', () => {});
      });

      context('when noteId conflicted', () => {
        it('takes server change', () => {});
      });

      context('when noteBlockIds conflicted', () => {
        it('merges all added ids', () => {});
        it('merge delete all deleted ids', () => {});
      });

      context('when linkedNoteIds conflicted', () => {
        it('merges all added ids', () => {});
        it('merge delete all deleted ids', () => {});
      });

      context('when content conflicted', () => {
        it('merges them', () => {});
      });
    });

    describe('when update <-> delete', () => {
      it('restores deleted version and applies updates with update <-> update resolution', () => {});
      it('puts it to conflicted root block', () => {});
    });

    describe('touched noteBlocks checking', () => {
      context('when some of noteBlockIds not exists', () => {
        it('deletes it', () => {});
      });
      context('when some of noteIds not exists', () => {
        it('deletes it', () => {});
      });
      context('when parent block id is note exists', () => {
        it('puts block to conflicted root block', () => {});
      });
    });
  });
});
