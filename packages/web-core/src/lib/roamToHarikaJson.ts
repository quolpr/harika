import dayjs from 'dayjs';
import { groupBy, uniqBy } from 'lodash-es';

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
import { generateId } from './generateId';

type ICommon = {
  'create-time'?: number;
  'edit-time'?: number;
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

type Node = PageNode | TextNode;

export const roamToHarikaJson = (data: PageNode[]) => {
  const links: BlockLinkDoc[] = [];
  let textDocs: TextBlockDoc[] = [];
  let noteDocs: NoteBlockDoc[] = [];

  const oldIdToNewIdMap: Record<string, string> = {};
  const newTitleToOldTitleMap: Record<string, string> = {};

  data.forEach((page, i) => {
    gatherData(
      undefined,
      page,
      i,
      noteDocs,
      textDocs,
      links,
      oldIdToNewIdMap,
      newTitleToOldTitleMap,
    );
  });

  replaceTitlesAndBlockIds(
    links,
    textDocs,
    noteDocs,
    oldIdToNewIdMap,
    newTitleToOldTitleMap,
  );

  // TODO: log which blocks were discarded
  noteDocs = uniqBy(noteDocs, (d) => d.id);
  textDocs = uniqBy(textDocs, (d) => d.id);

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
    ] as const,
  };
};

const gatherData = (
  parent: Node | undefined,
  currentNode: Node,
  orderPosition: number,
  noteDocs: NoteBlockDoc[],
  textBlocks: TextBlockDoc[],
  links: BlockLinkDoc[],
  oldIdToNewIdMap: Record<string, string>,
  newTitleToOldTitleMap: Record<string, string>,
) => {
  const getOrCreateNewId = (currentId: string) => {
    const newId = oldIdToNewIdMap[currentId] || generateId();

    oldIdToNewIdMap[currentId] = newId;

    return newId;
  };

  const newId = getOrCreateNewId(currentNode.uid);

  currentNode.refs?.forEach((ref) => {
    links.push({
      id: generateId(),
      blockId: newId,
      linkedToBlockId: getOrCreateNewId(ref.uid),
      orderPosition:
        Number.MAX_SAFE_INTEGER -
        (currentNode['create-time'] || new Date().getTime()),
      createdAt: currentNode['create-time'] || new Date().getTime(),
      updatedAt: currentNode['create-time'] || new Date().getTime(),
    });
  });

  (currentNode.children || []).forEach((child, i) => {
    gatherData(
      currentNode,
      child,
      i,
      noteDocs,
      textBlocks,
      links,
      oldIdToNewIdMap,
      newTitleToOldTitleMap,
    );
  });

  const parentId = parent?.uid ? getOrCreateNewId(parent?.uid) : undefined;

  if ('title' in currentNode) {
    const time = new Date(currentNode.uid).getTime();
    const newTitle = time && dayjs(time).format('D MMM YYYY');

    if (newTitle) {
      newTitleToOldTitleMap[newTitle] = currentNode.title;
    }

    noteDocs.push({
      id: newId,
      title: currentNode.title,
      ...(!time || !newTitle
        ? { dailyNoteDate: null }
        : {
            dailyNoteDate: time,
            title: dayjs(time).format('D MMM YYYY'),
          }),
      type: 'noteBlock',
      parentId,
      orderPosition,
      createdAt: currentNode['create-time'] || new Date().getTime(),
      updatedAt: currentNode['edit-time'] || new Date().getTime(),
    });
  } else {
    textBlocks.push({
      id: newId,
      content: currentNode.string,
      type: 'textBlock',
      parentId,
      orderPosition,
      createdAt: currentNode['create-time'] || new Date().getTime(),
      updatedAt: currentNode['edit-time'] || new Date().getTime(),
    });
  }
};

const replaceTitlesAndBlockIds = (
  links: BlockLinkDoc[],
  textDocs: TextBlockDoc[],
  noteDocs: NoteBlockDoc[],
  oldIdToNewIdMap: Record<string, string>,
  newTitleToOldTitleMap: Record<string, string>,
) => {
  const textDocsMap: Record<string, TextBlockDoc> = Object.fromEntries(
    textDocs.map((d) => [d.id, d]),
  );
  const noteDocsMap: Record<string, NoteBlockDoc> = Object.fromEntries(
    noteDocs.map((d) => [d.id, d]),
  );

  const newIdToOldIdMap = Object.fromEntries(
    Object.entries(oldIdToNewIdMap).map(([k, v]) => [v, k]),
  );

  links.forEach(({ linkedToBlockId, blockId }) => {
    const textDoc = textDocsMap[blockId];

    if (textDoc) {
      const linkedToNoteDoc = noteDocsMap[linkedToBlockId];

      if (linkedToNoteDoc) {
        if (newTitleToOldTitleMap[linkedToNoteDoc.title]) {
          textDoc.content = textDoc.content.replaceAll(
            `[[${newTitleToOldTitleMap[linkedToNoteDoc.title]}]]`,
            `[[${linkedToNoteDoc.title}]]`,
          );
        }
      } else {
        const oldId = newIdToOldIdMap[linkedToBlockId];

        textDoc.content.replaceAll(`((${oldId}))`, `((${linkedToBlockId}))`);
      }
    }
  });
};
