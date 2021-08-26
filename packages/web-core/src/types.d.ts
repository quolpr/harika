// Type definitions for sql.js 1.4
// Project: https://github.com/sql-js/sql.js
// Definitions by: Florian Imdahl <https://github.com/ffflorian>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

import 'sql-bricks';

declare module 'sql-bricks' {
  interface InsertStatement {
    orReplace: () => InsertStatement;
  }
}
