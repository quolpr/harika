import { BaseBlock } from '../models/BaseBlock';
import { BlockLinksStore } from '../models/BlockLinkStore';
import { BlocksScopeStore } from '../models/BlocksScopeStore';
import { getCollapsableBlock } from '../models/CollapsableBlock';

export const getGroupedBacklinks = (
  blockLinksStore: BlockLinksStore,
  scopesStore: BlocksScopeStore,
  ofBlock: BaseBlock,
) => {
  const blockLinks = blockLinksStore.getBacklinksOfBlock(ofBlock.$modelId);

  const groupedBlocks: Map<BaseBlock, BaseBlock[]> = new Map();

  blockLinks.forEach((b) => {
    if (!b.blockRef.maybeCurrent) return;

    if (groupedBlocks.has(b.blockRef.maybeCurrent.root)) {
      groupedBlocks.get(b.blockRef.maybeCurrent.root)!.push(b.blockRef.current);
    } else {
      groupedBlocks.set(b.blockRef.maybeCurrent.root, [b.blockRef.current]);
    }
  });

  const res = {
    links: Array.from(groupedBlocks.entries()).map(([rootBlock, blocks]) => ({
      rootBlock,
      scopesWithBlocks: blocks.flatMap((block) => {
        const scope = scopesStore.getScope(ofBlock, block.$modelId);

        if (!scope) return [];

        return { scope, rootBlock: getCollapsableBlock(scope, block) };
      }),
    })),
    count: blockLinks.length,
  };

  return res;
};
