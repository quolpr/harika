import { expect } from '@esm-bundle/chai';

import { filterAst, findFirst, mapTokens } from './astHelpers';
import { parse } from './blockParser';

describe('filterAst', () => {
  it('works', () => {
    const parsedData = parse('google.com [[my link]]', () => () => '123');

    expect(filterAst(parsedData, (t) => t.type === 'noteRef')).to.deep.eq([
      {
        content: 'my link',
        ref: 'my link',
        alias: undefined,
        id: '123',
        offsetEnd: 22,
        offsetStart: 11,
        type: 'noteRef',
      },
    ]);
  });

  it('works with nested tokens', () => {
    const parsedData = parse(
      'google.com __**[[wow]]**__ test@test.com eee test.ru',
      () => () => '123',
    );

    expect(filterAst(parsedData, (t) => t.type === 'noteRef')).to.deep.eq([
      {
        content: 'wow',
        id: '123',
        offsetEnd: 22,
        offsetStart: 15,
        type: 'noteRef',
        alias: undefined,
        ref: 'wow',
      },
    ]);
  });
});

describe('findFirst', () => {
  const parsedData = parse(
    'google.com **[[my link]]** [[wow2]]',
    () => () => '123',
  );

  it('works', () => {
    expect(findFirst(parsedData, (t) => t.type === 'noteRef')).to.deep.eq({
      content: 'my link',
      id: '123',
      offsetEnd: 24,
      offsetStart: 13,
      type: 'noteRef',
      alias: undefined,
      ref: 'my link',
    });
  });

  it('return undefined if not found', () => {
    expect(findFirst(parsedData, (t) => t.type === 'tag')).to.eq(undefined);
  });
});

describe('mapTokens', () => {
  const parsedData = parse(
    'google.com **[[my link]]** [[wow2]]',
    () => () => '123',
  );

  it('works', () => {
    expect(mapTokens(parsedData, (t) => ({ ...t, id: '123' }))).to.deep.eq([
      {
        id: '123',
        type: 'link',
        linkType: 'url',
        content: 'google.com',
        href: 'http://google.com',
        offsetStart: 0,
        offsetEnd: 10,
      },
      { id: '123', type: 'str', content: ' ', offsetStart: 10, offsetEnd: 11 },
      {
        id: '123',
        type: 'bold',
        content: [
          {
            id: '123',
            type: 'noteRef',
            content: 'my link',
            offsetStart: 13,
            offsetEnd: 24,
            alias: undefined,
            ref: 'my link',
          },
        ],
        offsetStart: 11,
        offsetEnd: 26,
      },
      { id: '123', type: 'str', content: ' ', offsetStart: 26, offsetEnd: 27 },
      {
        id: '123',
        type: 'noteRef',
        content: 'wow2',
        ref: 'wow2',
        alias: undefined,
        offsetStart: 27,
        offsetEnd: 35,
      },
    ]);
  });
});
