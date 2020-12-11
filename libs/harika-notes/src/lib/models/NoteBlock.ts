import { Model, Q, Query, Relation } from '@nozbe/watermelondb';
import {
  action,
  children,
  date,
  field,
  lazy,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { Note } from './Note';
import { NoteRef } from './NoteRef';
import { HarikaNotesTableName } from './schema';

export class NoteBlock extends Model {
  static table = HarikaNotesTableName.NOTE_BLOCKS;

  static associations: Associations = {
    [HarikaNotesTableName.NOTES]: { type: 'belongs_to', key: 'note_id' },
    [HarikaNotesTableName.NOTE_BLOCKS]: {
      type: 'has_many',
      foreignKey: 'parent_block_id',
    },
    [HarikaNotesTableName.NOTE_REFS]: {
      type: 'has_many',
      foreignKey: 'note_block_id',
    },
  };

  @relation(HarikaNotesTableName.NOTES, 'note_id') note!: Relation<Note>;
  @relation(HarikaNotesTableName.NOTE_BLOCKS, 'parent_block_id')
  parentBlock!: Relation<NoteBlock>;
  @children(HarikaNotesTableName.NOTE_BLOCKS) childBlocks!: Query<NoteBlock>;
  @children(HarikaNotesTableName.NOTE_REFS) refs!: Query<NoteRef>;

  @field('note_id') noteId!: string;
  @field('parent_block_id') parentBlockId!: string | undefined;
  @field('content') content!: string;
  @field('order') order!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  static sort = (blocks: NoteBlock[]) => {
    return blocks.sort((a, b) => a.order - b.order);
  };

  static async traverseLast(block: NoteBlock): Promise<NoteBlock | undefined> {
    const children = this.sort(await block.childBlocks.fetch());

    if (children.length === 0) return block;

    return await this.traverseLast(children[children.length - 1]);
  }

  static async reversetRight(block: NoteBlock): Promise<NoteBlock | undefined> {
    const parent = (await block.parentBlock.fetch()) || undefined;

    if (!parent) return undefined;

    const [, right] = await parent.getLeftAndRightSibling();

    if (right) return right;

    return this.reversetRight(parent);
  }

  async getAllSiblings() {
    if (!this.parentBlockId) {
      return NoteBlock.sort(
        (await (await this.note.fetch())?.childNoteBlocks.fetch()) || []
      );
    }

    const parentBlock = await this.parentBlock.fetch();

    return NoteBlock.sort((await parentBlock?.childBlocks.fetch()) || []);
  }

  async getLeftAndRightSibling(): Promise<
    [left: NoteBlock | undefined, right: NoteBlock | undefined]
  > {
    const siblings = await this.getAllSiblings();

    const index = siblings.findIndex((ch) => this.id === ch.id);

    return [siblings[index - 1], siblings[index + 1]];
  }

  async getLeftAndRight(): Promise<
    [left: NoteBlock | undefined, right: NoteBlock | undefined]
  > {
    let [left, right] = await this.getLeftAndRightSibling();

    if (left) {
      left = (await NoteBlock.traverseLast(left)) || undefined;
    }

    if (!left) {
      left = (await this.parentBlock.fetch()) || undefined;
    }

    const children = NoteBlock.sort(await this.childBlocks.fetch());

    if (children[0]) {
      right = children[0];
    }

    if (!right) {
      right = await NoteBlock.reversetRight(this);
    }

    return [left, right];
  }

  async getAllRightSiblings() {
    return (await this.getAllSiblings()).filter((b) => b.order > this.order);
  }

  @lazy
  childNoteBlocks = this.childBlocks.extend(
    Q.where('parent_block_id', Q.eq(null))
  );

  @action async mergeToLeftAndDelete() {
    const [left] = await this.getLeftAndRight();

    if (!left) return;

    left.update((record) => {
      record.content = record.content + this.content;
    });

    const children = await this.childBlocks.fetch();

    children.forEach((child) => {
      child.update((toUpdate) => {
        toUpdate.parentBlockId = left.id;
      });
    });

    await this.markAsDeleted();

    return left;
  }

  @action async injectNewRightBlock(content: string) {
    const children = await this.childBlocks.fetch();

    const { toMove, newEntityValues } = await (async () => {
      if (children.length) {
        return {
          toMove: children,
          newEntityValues: { order: 0, parentBlockId: this.id },
        };
      } else {
        return {
          toMove: await this.getAllRightSiblings(),
          newEntityValues: {
            order: this.order + 1,
            parentBlockId: this.parentBlockId,
          },
        };
      }
    })();

    toMove.forEach((block) => {
      block.update((modification) => {
        modification.order = modification.order + 1;
      });
    });

    return await this.collections
      .get<NoteBlock>(HarikaNotesTableName.NOTE_BLOCKS)
      .create((block) => {
        block.noteId = this.noteId;
        block.parentBlockId = newEntityValues.parentBlockId;
        block.order = newEntityValues.order;
        block.content = content;
      });
  }

  @action async makeParentTo(
    blockId: string | undefined,
    afterBlockId: string | undefined
  ) {
    const afterBlock = afterBlockId
      ? await this.collections
          .get<NoteBlock>(HarikaNotesTableName.NOTE_BLOCKS)
          .find(afterBlockId)
      : undefined;

    if (afterBlock) {
      const rightSiblings = await afterBlock.getAllRightSiblings();

      rightSiblings.forEach((block) => {
        block.update((modification) => {
          modification.order = modification.order + 2;
        });
      });
    }

    this.update((forUpdate) => {
      forUpdate.parentBlockId = blockId;
      forUpdate.order = afterBlock ? afterBlock.order + 1 : 0;
    });
  }

  @action async tryMoveUp() {
    const [left] = await this.getLeftAndRightSibling();

    if (left) {
      const leftChildren = NoteBlock.sort(await left.childBlocks.fetch());

      await this.subAction(() =>
        this.makeParentTo(left.id, leftChildren[leftChildren.length - 1]?.id)
      );
    }
  }

  @action async tryMoveDown() {
    const parent = (await this.parentBlock.fetch()) || undefined;
    const parentOfParent = (await parent?.parentBlock?.fetch()) || undefined;

    if (parentOfParent === undefined && parent === undefined) return;

    await this.subAction(() =>
      this.makeParentTo(parentOfParent?.id, parent?.id)
    );
  }

  @action async createNotesAndRefsIfNeeded() {
    const notes = this.collections.get<Note>(HarikaNotesTableName.NOTES);
    const refs = this.collections.get<NoteRef>(HarikaNotesTableName.NOTE_REFS);

    const names = [...this.content.matchAll(/\[\[(.+?)\]\]/g)].map(
      ([, name]) => name
    );

    const existingNotesIndexed = Object.fromEntries(
      (await notes.query(Q.where('title', Q.oneOf(names))).fetch()).map((n) => [
        n.title,
        n,
      ])
    );

    const allNotes = await Promise.all(
      names.map(async (name) => {
        if (!existingNotesIndexed[name]) {
          return notes.create((rec) => {
            rec.title = name;
          });
        } else {
          return existingNotesIndexed[name];
        }
      })
    );

    const allNotesIndexed = Object.fromEntries(allNotes.map((n) => [n.id, n]));

    const existingRefs = await this.refs.fetch();
    const existingRefsIndexed = Object.fromEntries(
      existingRefs.map((ref) => [ref.noteId, ref])
    );

    // create new refs
    await Promise.all(
      allNotes.map(async (note) => {
        if (!existingRefsIndexed[note.id]) {
          await refs.create((toCreate) => {
            console.log(note.id, this.id);
            toCreate.noteId = note.id;
            toCreate.noteBlockId = this.id;
          });
        }
      })
    );

    await Promise.all(
      Object.values(existingRefsIndexed).map(async (ref) => {
        if (!allNotesIndexed[ref.noteId]) {
          return await ref.destroyPermanently();
        }
      })
    );
  }

  @action async updateNoteRefName(oldName: string, newName: string) {
    this.update((toUpdate) => {
      toUpdate.content = Object.assign('', this.content).replace(
        new RegExp(`\\[\\[${oldName}\\]\\]/`, 'g'),
        `[[${newName}]]`
      );
    });
  }
}
