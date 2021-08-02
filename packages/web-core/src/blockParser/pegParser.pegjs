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
  = result:((OneLineTokens / TagWithBrackets / Tag)? Data) { 
    return result[0] ? [...(Array.isArray(result[0]) ? result[0] : [result[0]]), ...result[1]] : result[1]
  }
 
Data
  = result:(Token / .)* { 
    const loc = location();

    return joinChars(result.flat(), loc.start.offset); 
  }
  
Token
  = EOLOneLineTokens /  SpaceBeforeTag / Bold / Italic / Highlight / CodeBlock / InlineCode /  Ref 
 
Ref
  = '[[' content:($[^'\]\]']+) ']]' { 
    const loc = location();

    return {id: options.generateId(), type: 'ref', content: content, offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }

TagWithBrackets
  = '#[[' content:($[^'\]\]']+) ']]' { 
    const loc = location();

    return {id: options.generateId(), type: 'tag', ref: content, content: content, offsetStart: loc.start.offset, offsetEnd: loc.end.offset, withBrackets: true} 
  }

Tag
  = '#' content:($[^' '^'\n'^'\r'^'\t'^'\f']+) {
    const loc = location();

    return {id: options.generateId(), type: 'tag', ref: content, content: content, offsetStart: loc.start.offset, offsetEnd: loc.end.offset, withBrackets: false}
  }

SpaceBeforeTag
  = before:([' '\n\r\t\f]) tag:(TagWithBrackets / Tag) {

    return [before, tag];
  }

Bold
  = '**' content:(Token / $[^'**'])* '**' { 
    const loc = location();

    return {id: options.generateId(), type: 'bold', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset} 
  }
 
Italic
  = '__' content:(Token / $[^'__'])*  '__' {
    const loc = location();

    return {id: options.generateId(), type: 'italic', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }
  
Highlight
  = '^^' content:(Token / $[^'^^'])*  '^^' {
    const loc = location();

    return {id: options.generateId(), type: 'highlight', content: joinChars(content, loc.start.offset + 2), offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }
  

OneLineTokens
  = result:((Quote EOL?) / (Head EOL?))+ {
    return result.map(([token, hasEnd]) => {
      return {...token, withTrailingEOL: hasEnd !== null, offsetEnd: hasEnd !== null ? token.offsetEnd + 1 : token.offsetEnd};
    })
  }

EOLOneLineTokens
  = EOL result:(OneLineTokens) {
    return ["\n", ...result] 
  }

Quote
  = '> ' content:(!EOL (Token/.))+  {
    const loc = location();
 
    return {id: options.generateId(), type: 'quote', offsetStart: loc.start.offset, offsetEnd: loc.end.offset, content: joinChars(content.map(([, val]) => val), loc.start.offset + 2) }
  }

Head
  = depth:('###' / '##') content:(!EOL (Token/.))+ {
    const loc = location();

    return {id: options.generateId(), type: 'head', depth: depth.length, offsetStart: loc.start.offset, offsetEnd: loc.end.offset, content: joinChars(content.map(([, val]) => val), loc.start.offset + depth.length) }
  }

InlineCode
  = '`' content:$[^`]* '`' { 
    const loc = location();

    return {id: options.generateId(), type: 'inlineCode', content: content, offsetStart: loc.start.offset, offsetEnd: loc.end.offset}
  }

CodeBlock
  = '```' content:(!'```' .)* ending:(('```' EOL)/'```') { 
    const loc = location();

    return {id: options.generateId(), type: 'codeBlock', content: content.map(([, v]) => v).join(''), offsetStart: loc.start.offset, offsetEnd: loc.end.offset, withTrailingEOL: ending.length === 2}
  }

EOL "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028" // line spearator
  / "\u2029" // paragraph separator
