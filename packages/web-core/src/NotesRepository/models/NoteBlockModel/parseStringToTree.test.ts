import { expect } from '@esm-bundle/chai';
import { parseStringToTree } from './parseStringToTree';

describe('parseStringToTree', () => {
  it('handles broken indent', () => {
    expect(
      parseStringToTree(`
        - block1
         - block2
          - block3
             - block4
            - block5
             - block6
           - block7
             - block8
                           - block9
           - block10
        - block11
         - block12
      `),
    ).to.deep.equal([
      { indent: 0, content: 'block1' },
      { indent: 1, content: 'block2' },
      { indent: 2, content: 'block3' },
      { indent: 3, content: 'block4' },
      { indent: 3, content: 'block5' },
      { indent: 4, content: 'block6' },
      { indent: 3, content: 'block7' },
      { indent: 4, content: 'block8' },
      { indent: 5, content: 'block9' },
      { indent: 3, content: 'block10' },
      { indent: 0, content: 'block11' },
      { indent: 1, content: 'block12' },
    ]);
  });

  it('handles when first indent is wrong', () => {
    expect(
      parseStringToTree(`
        - block1
          - block2
      - block3
       - block4
      `),
    ).to.deep.equal([
      { indent: 0, content: 'block1' },
      { indent: 1, content: 'block2' },
      { indent: 0, content: 'block3' },
      { indent: 1, content: 'block4' },
    ]);
  });
});
