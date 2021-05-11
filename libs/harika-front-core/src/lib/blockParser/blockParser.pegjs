{
  const generateId = function () {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return '_' + Math.random().toString(36).substr(2, 9);
  };

  function joinChars(tokens) {
    let currentStr = '';
    const newTokens = [];
    
    tokens.forEach((token, i) => {
      if (typeof token === 'string') {
        currentStr += token;
      } else {
        if (currentStr.length !== 0) {
          newTokens.push({id: generateId(), type: 'str', content: currentStr});
          currentStr = '';
        }
        newTokens.push(token);
      }
    });
    
    if (currentStr.length) {
      newTokens.push({id: generateId(), type: 'str', content: currentStr});
      currentStr = '';
    }
    
    return newTokens;
  }
}

Expression
  = result:(Token / .)* { return joinChars(result); }
  
Token
  = Bold / Italic / Highlight / CodeBlock / InlineCode / Tag / Ref / Head
 
Ref
  = '[[' content:([^^'\]\]']+) ']]' { return {id: generateId(), type: 'ref', content: content.join('')} }

Tag
  = '#[[' content:([^^'\]\]']+) ']]' { return {id: generateId(), type: 'tag', content: content.join('')} }

Bold
  = '**' content:(Token / [^'**'])* '**' { return {id: generateId(), type: 'bold', content: joinChars(content)} }
 
Italic
  = '__' content:(Token / [^'__'])*  '__' { return {id: generateId(), type: 'italic', content: joinChars(content)} }
  
Highlight
  = '^^' content:(Token / [^'^^'])*  '^^' { return {id: generateId(), type: 'highlight', content: joinChars(content)} }
  
Head
  = depth:('###' / '##' / '#') content:(!EOL (Token/.))+ { return {id: generateId(), type: 'head', depth: depth.length, content: joinChars(content.map(([, val]) => val))} }

InlineCode
  = '`' content:[^`]* '`' { return {id: generateId(), type: 'inlineCode', content: content.join('')} }

CodeBlock
  = '```' content:[^(```)]* '```' { return {id: generateId(), type: 'codeBlock', content: content.join('')} }

EOL "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028" // line spearator
  / "\u2029" // paragraph separator

