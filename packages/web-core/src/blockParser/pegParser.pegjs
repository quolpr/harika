{
  // TODO: use range() insted when https://github.com/peggyjs/peggy/pull/145 released - no performance issues
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

          newTokens.push({id: options.generateId(), type: 'str', content: currentStr, offsetStart: offsetEnd - currentStr.length, offsetEnd});
          currentStr = '';
        }
        newTokens.push(token);
        lastNonStrToken = token;
      }
    });
    
    if (currentStr.length) {
      const tOffsetStart = lastNonStrToken ? lastNonStrToken.offsetEnd : offsetStart;

      newTokens.push({id: options.generateId(), type: 'str', content: currentStr, offsetStart: tOffsetStart, offsetEnd: tOffsetStart + currentStr.length});
      currentStr = '';
    }
    
    return newTokens;
  }
}

Expression
  = result:(Head? Data) { 
    return result[0] ? [result[0], ...result[1]] : result[1]
  }
 
Data
  = result:(Token / .)* { 
    const loc = location();

    return joinChars(result.flat(), loc.start.offset); 
  }
  
Token
  = EolHead / Bold / Italic / Highlight / CodeBlock / InlineCode / Tag / Ref 
 
Ref
  = '[[' content:([^^'\]\]']+) ']]' { 
    const loc = location();

    return {id: options.generateId(), type: 'ref', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }

Tag
  = '#[[' content:([^^'\]\]']+) ']]' { 
    const loc = location();

    return {id: options.generateId(), type: 'tag', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }

Bold
  = '**' content:(Token / [^'**'])* '**' { 
    const loc = location();

    return {id: options.generateId(), type: 'bold', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }
 
Italic
  = '__' content:(Token / [^'__'])*  '__' {
    const loc = location();

    return {id: options.generateId(), type: 'italic', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }
  
Highlight
  = '^^' content:(Token / [^'^^'])*  '^^' {
    const loc = location();

    return {id: options.generateId(), type: 'highlight', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }
  
EolHead
  = result:(EOL Head) { return ["\n", result[1]] }

Head
  = depth:('###' / '##' / '#') content:(!EOL (Token/.))+ {
    const loc = location();

    return {id: options.generateId(), type: 'head', depth: depth.length, offsetStart: loc.start.offset, offsetEnd: loc.end.offset, content: joinChars(content.map(([, val]) => val), loc.start.offset + depth.length)}
  }

InlineCode
  = '`' content:[^`]* '`' { 
    const loc = location();

    return {id: options.generateId(), type: 'inlineCode', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }

CodeBlock
  = '```' content:[^(```)]* '```' { 
    const loc = location();

    return {id: options.generateId(), type: 'codeBlock', content: content.join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }

EOL "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028" // line spearator
  / "\u2029" // paragraph separator

