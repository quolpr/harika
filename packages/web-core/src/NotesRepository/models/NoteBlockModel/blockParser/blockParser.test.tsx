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
          withTrailingEOL: false,
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

    it('parses trailing EOL', () => {
      const parsedData = parse('#test\nhey!', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'head',
          depth: 1,
          offsetStart: 0,
          offsetEnd: 6,
          withTrailingEOL: true,
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
        {
          content: 'hey!',
          id: '123',
          offsetEnd: 10,
          offsetStart: 6,
          type: 'str',
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
          withTrailingEOL: false,
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

  describe('quote parser', () => {
    it('parses quotes', () => {
      const parsedData = parse('> hee! [[world]]', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'quote',
          offsetStart: 0,
          offsetEnd: 16,
          withTrailingEOL: false,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'hee! ',
              offsetStart: 2,
              offsetEnd: 7,
            },
            {
              id: '123',
              type: 'ref',
              content: 'world',
              offsetStart: 7,
              offsetEnd: 16,
            },
          ],
        },
      ]);
    });

    it('parses only one line quote', () => {
      const parsedData = parse('hey!\n> hee! [[world]]\nyep!', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'hey!\n',
          offsetStart: 0,
          offsetEnd: 5,
        },
        {
          id: '123',
          type: 'quote',
          offsetStart: 5,
          offsetEnd: 22,
          withTrailingEOL: true,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'hee! ',
              offsetStart: 7,
              offsetEnd: 12,
            },
            {
              id: '123',
              type: 'ref',
              content: 'world',
              offsetStart: 12,
              offsetEnd: 21,
            },
          ],
        },
        {
          id: '123',
          type: 'str',
          content: 'yep!',
          offsetStart: 22,
          offsetEnd: 26,
        },
      ]);
    });

    it('parses only from start line', () => {
      const parsedData = parse(
        'hey!\n test > hee! [[world]]\nyep!',
        () => '123',
      );

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'hey!\n test > hee! ',
          offsetStart: 0,
          offsetEnd: 18,
        },
        {
          id: '123',
          type: 'ref',
          content: 'world',
          offsetStart: 18,
          offsetEnd: 27,
        },
        {
          id: '123',
          type: 'str',
          content: '\nyep!',
          offsetStart: 27,
          offsetEnd: 32,
        },
      ]);
    });

    it('parses multiline quote', () => {
      const parsedData = parse('> hee!\n> test\nyes', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'quote',
          offsetStart: 0,
          offsetEnd: 7,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'hee!',
              offsetStart: 2,
              offsetEnd: 6,
            },
          ],
          withTrailingEOL: true,
        },
        {
          id: '123',
          type: 'quote',
          offsetStart: 7,
          offsetEnd: 14,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'test',
              offsetStart: 9,
              offsetEnd: 13,
            },
          ],
          withTrailingEOL: true,
        },
        {
          id: '123',
          type: 'str',
          content: 'yes',
          offsetStart: 14,
          offsetEnd: 17,
        },
      ]);
    });
    it('parses multiline quote not form start line', () => {
      const parsedData = parse('data \n> hee!\n> test\nyes', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'data \n',
          offsetStart: 0,
          offsetEnd: 6,
        },
        {
          id: '123',
          type: 'quote',
          offsetStart: 6,
          offsetEnd: 13,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'hee!',
              offsetStart: 8,
              offsetEnd: 12,
            },
          ],
          withTrailingEOL: true,
        },
        {
          id: '123',
          type: 'quote',
          offsetStart: 13,
          offsetEnd: 20,
          content: [
            {
              id: '123',
              type: 'str',
              content: 'test',
              offsetStart: 15,
              offsetEnd: 19,
            },
          ],
          withTrailingEOL: true,
        },
        {
          id: '123',
          type: 'str',
          content: 'yes',
          offsetStart: 20,
          offsetEnd: 23,
        },
      ]);
    });
  });

  describe('Code block parser', () => {
    it('parses codeblock', () => {
      const parsedData = parse('fwfwe ```aa(```', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'fwfwe ',
          offsetStart: 0,
          offsetEnd: 6,
        },
        {
          id: '123',
          type: 'codeBlock',
          content: 'aa(',
          offsetStart: 6,
          offsetEnd: 15,
          withTrailingEOL: false,
        },
      ]);
    });

    it('parses with "`" inside', () => {
      const parsedData = parse('fwfwe ```a`a`a```', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'str',
          content: 'fwfwe ',
          offsetStart: 0,
          offsetEnd: 6,
        },
        {
          id: '123',
          type: 'codeBlock',
          content: 'a`a`a',
          offsetStart: 6,
          offsetEnd: 17,
          withTrailingEOL: false,
        },
      ]);
    });

    it('eats ending EOL', () => {
      const parsedData = parse('```data```\ntest', () => '123');

      expect(parsedData).to.deep.eq([
        {
          id: '123',
          type: 'codeBlock',
          content: 'data',
          offsetStart: 0,
          offsetEnd: 11,
          withTrailingEOL: true,
        },
        {
          id: '123',
          type: 'str',
          content: 'test',
          offsetStart: 11,
          offsetEnd: 15,
        },
      ]);
    });
  });
});
