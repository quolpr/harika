import { expect } from 'chai';

import { PageNode, roamToHarikaJson } from './roamToHarikaJson';

describe('roamToHarikaJson', () => {
  const dailyNoteData = [
    {
      'create-time': 1607668461636,
      title: 'test title',
      ':create/user': { ':user/uid': 'ovuhJr9o9Qc4Sha7jQrVDBQer0c2' },
      uid: 'nMPiheLfp',
      'edit-time': 1607669776560,
      children: [
        {
          string: '[[September 23rd, 2021]] [[September 23rd, 2021]] hey!',
          'create-time': 1608721845828,
          ':block/refs': [{ ':block/uid': '09-23-2021' }],
          refs: [{ uid: '09-23-2021' }],
          ':create/user': {
            ':user/uid': 'ovuhJr9o9Qc4Sha7jQrVDBQer0c2',
          },
          uid: 'Glefk_NSB',
          'edit-time': 1608721860004,
          ':edit/user': {
            ':user/uid': 'ovuhJr9o9Qc4Sha7jQrVDBQer0c2',
          },
        },
      ],
    },
    {
      'create-time': 1632424770976,
      title: 'September 23rd, 2021',
      uid: '09-23-2021',
      'edit-time': 1632424770976,
    },
  ] as PageNode[];

  it('keeps none daily note title', () => {
    const res = roamToHarikaJson(dailyNoteData).data[0].rows;

    expect(res[0]).to.include({
      title: 'test title',
    });
  });

  it('fixes daily notes', () => {
    const res = roamToHarikaJson(dailyNoteData).data[0].rows;

    expect(res[1]).to.include({
      title: '23 Sep 2021',
      dailyNoteDate: 1632344400000,
      createdAt: 1632424770976,
      updatedAt: 1632424770976,
    });
    // Check that new id was generated
    expect(res[1].id.length).to.eq(20);
  });

  it('replaces daily notes', () => {
    const res = roamToHarikaJson(dailyNoteData).data[1].rows;

    expect(res[0]).to.include({
      content: '[[23 Sep 2021]] [[23 Sep 2021]] hey!',
      createdAt: 1608721845828,
      updatedAt: 1608721860004,
    });

    expect(res[0].id.length).to.eq(20);
  });

  // TODO: case with nested refs in note title
});
