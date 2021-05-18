{
  // TODO: unit test
  // TODO: use range() insted when https://github.com/peggyjs/peggy/pull/145 released - no performance issues

  const generateId = function () {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return '_' + Math.random().toString(36).substr(2, 9);
  };

  function joinChars(tokens, offsetStart) {
    let currentStr = '';
    const newTokens = [];

    let lastNonStrToken = null;
    
    tokens.forEach((token, i) => {
      if (typeof token === 'string') {
        currentStr += token;
      } else {
        if (currentStr.length !== 0) {
          const offsetEnd = token.offsetStart;

          newTokens.push({id: generateId(), type: 'str', content: currentStr, offsetStart: offsetEnd - currentStr.length, offsetEnd});
          currentStr = '';
        }
        newTokens.push(token);
        lastNonStrToken = token;
      }
    });
    
    if (currentStr.length) {
      const tOffsetStart = lastNonStrToken ? lastNonStrToken.offsetEnd : offsetStart;

      newTokens.push({id: generateId(), type: 'str', content: currentStr, offsetStart: tOffsetStart, offsetEnd: tOffsetStart + currentStr.length});
      currentStr = '';
    }
    
    return newTokens;
  }
}

Expression
  = result:(Token / .)* { 
    const loc = location();

    return joinChars(result, loc.start.offset); 
  }
  
Token
  = Bold / Italic / Highlight / CodeBlock / InlineCode / Tag / Ref / Head
 
Ref
  = '[[' content:([^^'\]\]']+) ']]' { 
    const loc = location();

    return {id: generateId(), type: 'ref', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }

Tag
  = '#[[' content:([^^'\]\]']+) ']]' { 
    const loc = location();

    return {id: generateId(), type: 'tag', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }

Bold
  = '**' content:(Token / [^'**'])* '**' { 
    const loc = location();

    return {id: generateId(), type: 'bold', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }
 
Italic
  = '__' content:(Token / [^'__'])*  '__' {
    const loc = location();

    return {id: generateId(), type: 'italic', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }
  
Highlight
  = '^^' content:(Token / [^'^^'])*  '^^' {
    const loc = location();

    return {id: generateId(), type: 'highlight', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }
  
Head
  = depth:('###' / '##' / '#') content:(!EOL (Token/.))+ {
    const loc = location();

    return {id: generateId(), type: 'head', depth: depth.length, content: joinChars(content.map(([, val]) => val), loc.start.offset + depth.length)}
  }

InlineCode
  = '`' content:[^`]* '`' { 
    const loc = location();

    return {id: generateId(), type: 'inlineCode', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }

CodeBlock
  = '```' content:[^(```)]* '```' { 
    const loc = location();

    return {id: generateId(), type: 'codeBlock', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }

EOL "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028" // line spearator
  / "\u2029" // paragraph separator

