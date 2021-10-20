// import { expect } from '@esm-bundle/chai';
// import {
//   normalizeBlockTree,
//   parseToBlocksTree,
// } from '../../../../blockParser/blockUtils';
// import { parseStringToTree } from '../../../../blockParser/parseStringToTree';

// describe('NoteBlockModel', () => {
//   describe('getStringTree', () => {
//     it('works', () => {
//       const expectedTree = normalizeBlockTree(`
//         - block1 [#1]
//           - block2 [#2]
//         - block5 [#3]
//       `);

//       const { note } = parseToBlocksTree(expectedTree);

//       expect(note.rootBlockId.current.getStringTree(true).trim()).to.equal(
//         expectedTree,
//       );
//     });

//     it('works with deeply nesting', () => {
//       const normalizedTree = normalizeBlockTree(`
//         - block1 [#1]
//           - block2 [#2]
//             - block3 [#3]
//             - block4 [#4]
//         - block5 [#5]
//       `);

//       const { note } = parseToBlocksTree(normalizedTree);

//       expect(note.rootBlockId.current.getStringTree(true).trim()).to.equal(
//         normalizedTree,
//       );
//     });
//   });

//   describe('injectNewTreeTokens', () => {
//     const toInsert = () => {
//       return parseStringToTree(`
//           - block6
//           - block7
//             - block8
//               - block9
//               - block10
//         - block11
//      `);
//     };
//     it('injects new tree to existent tree', () => {
//       const { vault, note } = parseToBlocksTree(`
//         - block0
//         - block1
//         - block2
//           - block3
//           - block4 [#4]
//         - block5
//       `);

//       vault.blocksMap['4'].injectNewTreeTokens(toInsert());

//       expect(note.rootBlockId.current.getStringTree().trim()).to.equal(
//         normalizeBlockTree(`
//           - block0
//           - block1
//           - block2
//             - block3
//             - block4
//             - block6
//             - block7
//               - block8
//                 - block9
//                 - block10
//             - block11
//           - block5
//         `),
//       );
//     });

//     it('handles paste to first child', () => {
//       const { vault, note } = parseToBlocksTree(`
//         - block0 [#0]
//         - block1
//         - block2
//       `);

//       vault.blocksMap['0'].injectNewTreeTokens(toInsert());

//       expect(note.rootBlockId.current.getStringTree().trim()).to.equal(
//         normalizeBlockTree(`
//           - block0
//           - block6
//           - block7
//             - block8
//               - block9
//               - block10
//           - block11
//           - block1
//           - block2
//         `),
//       );
//     });
//   });

//   describe('toggleTodo', () => {
//     context('has first todo and children', () => {
//       it('toggles self and children which has first TODO', () => {
//         const { vault, note } = parseToBlocksTree(`
//         - [[TODO]] block0 [#0]
//           - [[DONE]] block1
//           - block2
//             - [[TODO]] block3
//           - [[TODO]] block4 [#1]
//             - [[TODO]] block5 [#2]
//         `);
//         const block = vault.blocksMap['0'];

//         expect(block.toggleTodo(block.content.ast[0].id)).to.have.members([
//           '0',
//           '1',
//           '2',
//         ]);

//         expect(note.rootBlockId.current.getStringTree().trim()).to.equal(
//           normalizeBlockTree(`
//             - [[DONE]] block0
//               - [[DONE]] block1
//               - block2
//                 - [[TODO]] block3
//               - [[DONE]] block4
//                 - [[DONE]] block5
//           `),
//         );
//       });
//     });

//     context('has first done and children', () => {
//       it('toggles self and children which has first DONE', () => {
//         const { vault, note } = parseToBlocksTree(`
//         - [[DONE]] block0 [#0]
//           - [[DONE]] block1 [#1]
//           - block2
//             - [[DONE]] block3
//           - [[DONE]] block4 [#2]
//             - [[DONE]] block5 [#3]
//         `);
//         const block = vault.blocksMap['0'];

//         expect(block.toggleTodo(block.content.ast[0].id)).to.have.members([
//           '0',
//           '1',
//           '2',
//           '3',
//         ]);

//         expect(note.rootBlockId.current.getStringTree().trim()).to.equal(
//           normalizeBlockTree(`
//           - [[TODO]] block0
//             - [[TODO]] block1
//             - block2
//               - [[DONE]] block3
//             - [[TODO]] block4
//               - [[TODO]] block5
//           `),
//         );
//       });
//     });
//   });
// });
