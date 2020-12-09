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
import Note from './Note';
import { HarikaNotesTableName } from './schema';

export default class NoteBlock extends Model {
  static table = HarikaNotesTableName.NOTE_BLOCKS;

  static associations: Associations = {
    notes: { type: 'belongs_to', key: 'note_id' },
    note_blocks: { type: 'has_many', foreignKey: 'parent_block_id' },
  };

  @relation(HarikaNotesTableName.NOTES, 'note_id') note!: Relation<Note>;
  @relation(HarikaNotesTableName.NOTE_BLOCKS, 'parent_block_id')
  parentBlock!: Relation<NoteBlock>;
  @children(HarikaNotesTableName.NOTE_BLOCKS) childBlocks!: Query<NoteBlock>;

  @field('note_id') note_id!: string;
  @field('parent_block_id') parent_block_id!: string | undefined;
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
    const hasChildren = (await this.childBlocks.fetchCount()) > 0;

    if (hasChildren) return;

    const [left] = await this.getLeftAndRight();

    if (!left) return;

    left.update((record) => {
      record.content = record.content + this.content;
    });

    await this.markAsDeleted();

    return left;
  }

  @action async injectNewRightBlock(content: string) {
    const rightSiblings = await this.getAllRightSiblings();

    rightSiblings.forEach((block) => {
      block.update((modification) => {
        modification.order = modification.order + 1;
      });
    });

    return await this.collections
      .get<NoteBlock>(HarikaNotesTableName.NOTE_BLOCKS)
      .create((block) => {
        block.note_id = this.note_id;
        block.parent_block_id = this.parent_block_id;
        block.content = content;
        block.order = this.order + 1;
      });
  }

  @action async makeParentTo(
    blockId: string | undefined,
    afterBlockId: string | undefined
  ) {
    if (!blockId) return;

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
      forUpdate.parent_block_id = blockId;
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
    const parentToParent = (await parent?.parentBlock?.fetch()) || undefined;

    await this.subAction(() =>
      this.makeParentTo(parentToParent?.id, parent?.id)
    );
  }
}
