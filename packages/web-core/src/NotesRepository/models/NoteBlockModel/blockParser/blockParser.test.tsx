import { expect } from '@esm-bundle/chai';
import { parse } from './blockParser';

describe('Parser', () => {
  describe('ref parser', () => {
    it('parses ref', () => {
      const parsedData = parse('hee! [[world]]', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'hee! ',
          offsetStart: 0,
          offsetEnd: 5,
        },
        {
          id: '123',
          type: 'ref',
          content: 'world',
          offsetStart: 5,
          offsetEnd: 14,
        },
      ]);
    });
  });

  describe('head parser', () => {
    it('parses when it on first line', () => {
      const parsedData = parse('#test', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'head',
          depth: 1,
          offsetStart: 0,
          offsetEnd: 5,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'test',
              offsetStart: 1,
              offsetEnd: 5,
            },
          ],
        },
      ]);
    });

    it('parses when it is on new line', () => {
      const parsedData = parse('kek\n#test', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'kek\n',
          offsetStart: 0,
          offsetEnd: 4,
        },
        {
          id: '123',
          type: 'head',
          depth: 1,
          offsetStart: 4,
          offsetEnd: 9,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'test',
              offsetStart: 5,
              offsetEnd: 9,
            },
          ],
        },
      ]);
    });

    it("doesn't parse not on new line", () => {
      const parsedData = parse('kek\n kek #test', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'kek\n kek #test',
          offsetStart: 0,
          offsetEnd: 14,
        },
      ]);
    });
  });

  describe('link parser', () => {
    it('works with tags in url correctly', () => {
      const parsedData = parse('http://google.com#test', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'link',
          linkType: 'url',
          content: 'http://google.com#test',
          href: 'http://google.com#test',
          offsetStart: 0,
          offsetEnd: 22,
        },
      ]);
    });

    it('parses links without trailing empty str tokens', () => {
      const parsedData = parse('google.com', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          content: 'google.com',
          href: 'http://google.com',
          linkType: 'url',
          offsetEnd: 10,
          offsetStart: 0,
          type: 'link',
        },
      ]);
    });

    it('parses just domains as links', () => {
      const parsedData = parse(
        'google.com test@test.com eee test.ru',
        () => '123',
      );

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          content: 'google.com',
          href: 'http://google.com',
          linkType: 'url',
          offsetEnd: 10,
          offsetStart: 0,
          type: 'link',
        },
        {
          id: '123',
          content: ' ',
          offsetEnd: 11,
          offsetStart: 10,
          type: 'str',
        },
        {
          id: '123',
          content: 'test@test.com',
          href: 'mailto:test@test.com',
          linkType: 'email',
          offsetEnd: 24,
          offsetStart: 11,
          type: 'link',
        },
        {
          id: '123',
          content: ' eee ',
          offsetEnd: 29,
          offsetStart: 24,
          type: 'str',
        },
        {
          id: '123',
          content: 'test.ru',
          href: 'http://test.ru',
          linkType: 'url',
          offsetEnd: 36,
          offsetStart: 29,
          type: 'link',
        },
      ]);
    });

    it('parses links', () => {
      const parsedData = parse('heyy! http://google.com heyy2', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'heyy! ',
          offsetStart: 0,
          offsetEnd: 6,
        },
        {
          id: '123',
          type: 'link',
          linkType: 'url',
          content: 'http://google.com',
          href: 'http://google.com',
          offsetStart: 6,
          offsetEnd: 23,
        },
        {
          id: '123',
          type: 'str',
          content: ' heyy2',
          offsetStart: 23,
          offsetEnd: 29,
        },
      ]);
    });
  });
});
