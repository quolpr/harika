import { RxJsonSchema, RxCollection, RxDocument, RxQuery } from 'rxdb';
import { HarikaDatabase } from '../initDb';
import { HarikaDatabaseDocuments } from '../HarikaDatabaseDocuments';
import { NoteCollection, NoteDocType, NoteDocument } from './note';

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type NoteBlockDocType = {
  _id: string;
  parentBlockId: string | null;
  noteId: string;
  content: string;
  order: number;
};

export const schema: RxJsonSchema<NoteBlockDocType> = {
  title: 'hero schema',
  description: 'describes a note',
  version: 0,
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      primary: true,
    },
    parentBlockId: {
      ref: HarikaDatabaseDocuments.NOTE_BLOCKS,
      type: 'string',
    },
    noteId: {
      ref: HarikaDatabaseDocuments.NOTES,
      type: 'string',
    },
    content: {
      type: 'string',
    },
    order: {
      type: 'integer',
    },
  },
  required: ['noteId', 'content', 'order'],
  indexes: ['_id', 'noteId', 'order', 'parentBlockId'],
};

type DocMethods = {
  updateContent(content: string): Promise<void>;
  injectNewRightBlock(newContent: string): Promise<NoteBlockDocument>;
  mergeToLeftAndDelete(): Promise<NoteBlockDocument | undefined>;
  tryMoveUp(): Promise<void>;
  tryMoveDown(): Promise<void>;
  getLeftAndRight(): Promise<
    [left: NoteBlockDocument | undefined, right: NoteBlockDocument | undefined]
  >;
  getNote(): RxQuery<NoteDocType, NoteDocument | null>;
  getParentBlock(): RxQuery<NoteBlockDocType, NoteBlockDocument | null>;
  getChildBlocks(): RxQuery<NoteBlockDocType, NoteBlockDocument[]>;
  getAllSiblings(): Promise<NoteBlockDocument[]>;
  getAllRightSiblings(): Promise<NoteBlockDocument[]>;
  getLeftAndRightSibling(): Promise<
    [left: NoteBlockDocument | undefined, right: NoteBlockDocument | undefined]
  >;
  makeParentTo(
    blockId: string | undefined,
    afterBlockId: string | undefined
  ): Promise<void>;
  traverseLast(): Promise<NoteBlockDocument | undefined>;
  reverseRight(): Promise<NoteBlockDocument | undefined>;
  _cachedQuery?: RxQuery<NoteBlockDocType, NoteBlockDocument[]>;
};

let order = 1000;

export const docMethods: DocMethods = {
  getNote(this: NoteBlockDocument) {
    const notes = this.collection.database[
      HarikaDatabaseDocuments.NOTES
    ] as NoteCollection;

    return notes.findOne(this.noteId);
  },
  getParentBlock(this: NoteBlockDocument) {
    const noteBlocks = this.collection.database[
      HarikaDatabaseDocuments.NOTE_BLOCKS
    ] as NoteBlockCollection;

    return noteBlocks.findOne({ selector: { _id: this.parentBlockId } });
  },
  getChildBlocks(this: NoteBlockDocument) {
    if (this._cachedQuery) return this._cachedQuery;
    const noteBlocks = (window.db ? window.db : this.collection.database)[
      HarikaDatabaseDocuments.NOTE_BLOCKS
    ] as NoteBlockCollection;

    this._cachedQuery = noteBlocks
      .find({ selector: { parentBlockId: this._id } })
      .sort('order');

    return this._cachedQuery;
  },
  async getAllSiblings(this: NoteBlockDocument) {
    // TODO: make in RxJS way
    if (!this.parentBlockId) {
      return (
        (await (await this.getNote().exec())?.getChildNoteBlocks().exec()) || []
      );
    }
    const parentBlock = await this.getParentBlock().exec();

    return (await parentBlock?.getChildBlocks().exec()) || [];
  },
  async getAllRightSiblings(this: NoteBlockDocument) {
    // TODO: make in RxJS way
    return (await this.getAllSiblings()).filter((b) => b.order > this.order);
  },
  async getLeftAndRightSibling(
    this: NoteBlockDocument
  ): Promise<
    [left: NoteBlockDocument | undefined, right: NoteBlockDocument | undefined]
  > {
    const siblings = await this.getAllSiblings();

    const index = siblings.findIndex((ch) => this._id === ch._id);

    return [siblings[index - 1], siblings[index + 1]];
  },
  async makeParentTo(
    this: NoteBlockDocument,
    blockId: string | undefined,
    afterBlockId: string | undefined
  ) {
    const noteBlocks = this.collection.database[
      HarikaDatabaseDocuments.NOTE_BLOCKS
    ] as NoteBlockCollection;
    const afterBlock = afterBlockId
      ? await noteBlocks.findOne(afterBlockId).exec()
      : undefined;

    if (afterBlock) {
      const rightSiblings = await afterBlock.getAllRightSiblings();

      await Promise.all(
        rightSiblings.map((block) => {
          return block.atomicPatch({
            order: block.order + 2,
          });
        })
      );
    }

    this.atomicPatch({
      parentBlockId: blockId,
      order: afterBlock ? afterBlock.order + 1 : 0,
    });
  },
  async updateContent(this: NoteBlockDocument, content) {
    this.atomicPatch({
      content,
    });
  },
  async injectNewRightBlock(this: NoteBlockDocument, newContent) {
    const database = this.collection.database;
    // const children = await this.getChildBlocks().exec();

    // const { toMove, newEntityValues } = await (async () => {
    //   if (children.length) {
    //     return {
    //       toMove: children,
    //       newEntityValues: { order: 0, parentBlockId: this._id },
    //     };
    //   } else {
    //     return {
    //       toMove: await this.getAllRightSiblings(),
    //       newEntityValues: {
    //         order: this.order + 1,
    //         parentBlockId: this.parentBlockId,
    //       },
    //     };
    //   }
    // })();

    // console.log('update start');
    // await Promise.all(
    //   toMove.map((block) => {
    //     return block.update({ $inc: { order: 1 } });
    //   })
    // );
    // console.log('update finish');

    // TODO: fix `as unknown`
    return createBlockNote((database as unknown) as HarikaDatabase, {
      noteId: this.noteId,
      parentBlockId: null,
      order: order++,
      content: newContent,
    });
  },
  async mergeToLeftAndDelete(this: NoteBlockDocument) {
    const [left] = await this.getLeftAndRight();

    if (!left) return;

    left.atomicPatch({
      content: left.content + this.content,
    });

    const children = await this.getChildBlocks().exec();

    children.forEach((child) => {
      child.atomicPatch({ parentBlockId: left._id });
    });

    this.destroy();

    return left;
  },
  async tryMoveUp(this: NoteBlockDocument) {
    const [left] = await this.getLeftAndRightSibling();

    if (left) {
      const leftChildren = await left.getChildBlocks().exec();

      await this.makeParentTo(
        left._id,
        leftChildren[leftChildren.length - 1]?._id
      );
    }
  },
  async tryMoveDown(this: NoteBlockDocument) {
    const parent = (await this.getParentBlock().exec()) || undefined;
    const parentOfParent =
      (await parent?.getParentBlock()?.exec()) || undefined;

    if (parentOfParent === undefined && parent === undefined) return;

    return this.makeParentTo(parentOfParent?._id, parent?._id);
  },
  async traverseLast(this: NoteBlockDocument) {
    const children = await this.getChildBlocks().exec();

    if (children.length === 0) return this;

    return await children[children.length - 1].traverseLast();
  },
  async reverseRight(
    this: NoteBlockDocument
  ): Promise<NoteBlockDocument | undefined> {
    const parent = (await this.getParentBlock().exec()) || undefined;

    if (!parent) return undefined;

    const [, right] = await parent.getLeftAndRightSibling();

    if (right) return right;

    return parent.reverseRight();
  },

  async getLeftAndRight(this: NoteBlockDocument) {
    console.time('timer1');

    let [left, right] = await this.getLeftAndRightSibling();
    console.timeEnd('timer1');

    console.time('timer2');
    if (left) {
      left = (await left.traverseLast()) || undefined;
    }
    console.timeEnd('timer2');

    if (!left) {
      left = (await this.getParentBlock().exec()) || undefined;
    }

    console.time('timer3');
    const children = await this.getChildBlocks().exec();
    console.timeEnd('timer3');

    if (children[0]) {
      right = children[0];
    }

    if (!right) {
      right = await this.reverseRight();
    }

    return [left, right];
  },
};

export type NoteBlockCollection = RxCollection<NoteBlockDocType, DocMethods>;
export type NoteBlockDocument = RxDocument<NoteBlockDocType, DocMethods>;

export const createBlockNote = (
  database: HarikaDatabase,
  fields: Optional<NoteBlockDocType, '_id'>
) => {
  return database.noteblocks.insert(fields);
};

export const dbNoteBlocksCollection = {
  schema,
  methods: docMethods,
};
