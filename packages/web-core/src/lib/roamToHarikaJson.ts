import {
  BlockLinkDoc,
  BlockLinkRow,
  blockLinksTable,
} from '../apps/VaultApplication/BlocksExtension/repositories/BlockLinkRepository';
import {
  NoteBlockDoc,
  noteBlocksTable,
} from '../apps/VaultApplication/BlocksExtension/repositories/NoteBlocksRepostitory';
import {
  TextBlockDoc,
  textBlocksTable,
} from '../apps/VaultApplication/BlocksExtension/repositories/TextBlocksRepository';
import { Dump } from '../apps/VaultApplication/BlocksExtension/services/ImportExportService';

type ICommon = {
  'create-time': number;
  'edit-time': number;
  uid: string;
  refs?: { uid: string }[];
};
export type PageNode = ICommon & {
  title: string;
  children?: TextNode[];
};
type TextNode = ICommon & {
  string: string;
  children?: TextNode[];
};

export const roamToHarikaJson = (data: PageNode[]): Dump => {
  const links: BlockLinkRow[] = [];
  const textDocs: TextBlockDoc[] = [];
  const noteDocs: NoteBlockDoc[] = [];

  for (const page of data) {
    gatherData(page, noteDocs, textDocs, links);
  }

  return {
    version: 2,
    data: [
      {
        tableName: noteBlocksTable,
        rows: noteDocs,
      },
      {
        tableName: textBlocksTable,
        rows: textDocs,
      },
      {
        tableName: blockLinksTable,
        rows: links,
      },
    ],
  };
};

const gatherData = (
  currentNode: PageNode,
  noteDocs: NoteBlockDoc[],
  textBlocks: TextBlockDoc[],
  links: BlockLinkDoc[],
) => {};
