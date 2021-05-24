import { parse } from './blockParser';

describe('Parser', () => {
  describe('ref parser', () => {
    it('parses ref', () => {
      const parsedData = parse('hee! [[world]]');

      expect(parsedData).toEqual(
        expect.arrayContaining([
          {
            id: expect.any(String),
            type: 'str',
            content: 'hee! ',
            offsetStart: 0,
            offsetEnd: 5,
          },
          {
            id: expect.any(String),
            type: 'ref',
            content: 'world',
            offsetStart: 5,
            offsetEnd: 14,
          },
        ]),
      );
    });
  });

  describe('link parser', () => {
    it('parses links without trailing empty str tokens', () => {
      const parsedData = parse('google.com');

      expect(parsedData).toEqual(
        expect.arrayContaining([
          {
            id: expect.any(String),
            content: 'google.com',
            href: 'http://google.com',
            linkType: 'url',
            offsetEnd: 10,
            offsetStart: 0,
            type: 'link',
          },
        ]),
      );
    });

    it('parses just domains as links', () => {
      const parsedData = parse('google.com test@test.com eee test.ru');

      expect(parsedData).toEqual(
        expect.arrayContaining([
          {
            id: expect.any(String),
            content: 'google.com',
            href: 'http://google.com',
            linkType: 'url',
            offsetEnd: 10,
            offsetStart: 0,
            type: 'link',
          },
          {
            id: expect.any(String),
            content: ' ',
            offsetEnd: 11,
            offsetStart: 10,
            type: 'str',
          },
          {
            id: expect.any(String),
            content: 'test@test.com',
            href: 'mailto:test@test.com',
            linkType: 'email',
            offsetEnd: 24,
            offsetStart: 11,
            type: 'link',
          },
          {
            id: expect.any(String),
            content: ' eee ',
            offsetEnd: 29,
            offsetStart: 24,
            type: 'str',
          },
          {
            id: expect.any(String),
            content: 'test.ru',
            href: 'http://test.ru',
            linkType: 'url',
            offsetEnd: 36,
            offsetStart: 29,
            type: 'link',
          },
        ]),
      );
    });

    it('parses links', () => {
      const parsedData = parse('heyy! http://google.com heyy2');

      expect(parsedData).toEqual(
        expect.arrayContaining([
          {
            id: expect.any(String),
            type: 'str',
            content: 'heyy! ',
            offsetStart: 0,
            offsetEnd: 6,
          },
          {
            id: expect.any(String),
            type: 'link',
            linkType: 'url',
            content: 'http://google.com',
            href: 'http://google.com',
            offsetStart: 6,
            offsetEnd: 23,
          },
          {
            id: expect.any(String),
            type: 'str',
            content: ' heyy2',
            offsetStart: 23,
            offsetEnd: 29,
          },
        ]),
      );
    });
  });
});
