import { filterAst, findFirst, mapTokens } from './astHelpers';
import { parse } from './blockParser';

describe('filterAst', () => {
  it('works', () => {
    const parsedData = parse('google.com [[my link]]');

    expect(filterAst(parsedData, (t) => t.type === 'ref')).toEqual(
      expect.arrayContaining([
        {
          content: 'my link',
          id: expect.any(String),
          offsetEnd: 22,
          offsetStart: 11,
          type: 'ref',
        },
      ]),
    );
  });

  it('works with nested tokens', () => {
    const parsedData = parse(
      'google.com __**[[wow]]**__ test@test.com eee test.ru',
    );

    expect(filterAst(parsedData, (t) => t.type === 'ref')).toEqual(
      expect.arrayContaining([
        {
          content: 'wow',
          id: expect.any(String),
          offsetEnd: 22,
          offsetStart: 15,
          type: 'ref',
        },
      ]),
    );
  });
});

describe('findFirst', () => {
  const parsedData = parse('google.com **[[my link]]** [[wow2]]');

  it('works', () => {
    expect(findFirst(parsedData, (t) => t.type === 'ref')).toEqual(
      expect.objectContaining({
        content: 'my link',
        id: expect.any(String),
        offsetEnd: 24,
        offsetStart: 13,
        type: 'ref',
      }),
    );
  });

  it('return undefined if not found', () => {
    expect(findFirst(parsedData, (t) => t.type === 'tag')).toEqual(undefined);
  });
});

describe('mapTokens', () => {
  const parsedData = parse('google.com **[[my link]]** [[wow2]]');

  it('works', () => {
    expect(mapTokens(parsedData, (t) => ({ ...t, id: '123' }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'google.com',
          id: '123',
          type: 'link',
        }),
        expect.objectContaining({
          content: ' ',
          id: '123',
          type: 'str',
        }),
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              content: 'my link',
              id: '123',
              type: 'ref',
            }),
          ]),
          id: '123',
          type: 'bold',
        }),
        expect.objectContaining({
          id: '123',
          type: 'str',
        }),
        expect.objectContaining({
          id: '123',
          type: 'ref',
        }),
      ]),
    );
  });
});
