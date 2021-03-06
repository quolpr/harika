{
  function joinChars(tokens) {
    let currentStr = '';
    const newTokens = [];
    
    tokens.forEach((token, i) => {
      if (typeof token === 'string') {
        currentStr += token;
      } else {
        if (currentStr.length !== 0) {
          newTokens.push({type: 'str', content: currentStr});
          currentStr = '';
        }
        newTokens.push(token);
      }
    });
    
    if (currentStr.length) {
      newTokens.push({type: 'str', content: currentStr});
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
  = '[[' content:([^^'\]\]']+) ']]' { return {type: 'ref', content: content.join('')} }

Tag
  = '#[[' content:([^^'\]\]']+) ']]' { return {type: 'tag', content: content.join('')} }

Bold
  = '**' content:(Token / [^'**'])* '**' { return {type: 'bold', content: joinChars(content)} }
 
Italic
  = '__' content:(Token / [^'__'])*  '__' { return {type: 'italic', content: joinChars(content)} }
  
Highlight
  = '^^' content:(Token / [^'^^'])*  '^^' { return {type: 'highlight', content: joinChars(content)} }
  
Head
  = depth:('###' / '##' / '#') content:(!EOL (Token/.))+ { return {type: 'head', depth: depth.length, content: joinChars(content.map(([, val]) => val))} }

InlineCode
  = '`' content:[^`]* '`' { return {type: 'inlineCode', content: content.join('')} }

CodeBlock
  = '```' content:[^(```)]* '```' { return {type: 'codeBlock', content: content.join('')} }

EOL "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028" // line spearator
  / "\u2029" // paragraph separator

