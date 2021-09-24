import { Pos } from 'caret-pos';
import React, { MutableRefObject, useCallback, useMemo } from 'react';
import { EditorDropdown } from '../EditorDropdown/EditorDropdown';

const todoCommand = {
  id: 'todo' as const,
  title: 'TODO',
};
const currentTimeCommand = {
  id: 'currentTime' as const,
  title: 'Current time',
};

const pageRefCommand = {
  id: 'pageRef' as const,
  title: 'Page Reference',
};

const boldCommand = {
  id: 'bold' as const,
  title: 'Bold',
};

const italicsCommand = {
  id: 'italics' as const,
  title: 'Italics',
};

const highlightCommand = {
  id: 'highlight' as const,
  title: 'Highlight',
};

const strikethroughCommand = {
  id: 'strikethrough' as const,
  title: 'Strikethrough',
};

const codeInlineCommand = {
  id: 'codeInline' as const,
  title: 'Code Inline',
};

const codeBlockCommand = {
  id: 'codeBlock' as const,
  title: 'Code Block',
};

export type ICommand =
  | typeof currentTimeCommand
  | typeof todoCommand
  | typeof pageRefCommand
  | typeof boldCommand
  | typeof italicsCommand
  | typeof highlightCommand
  | typeof strikethroughCommand
  | typeof codeInlineCommand
  | typeof codeBlockCommand;

const commands: ICommand[] = [
  todoCommand,
  currentTimeCommand,
  pageRefCommand,
  boldCommand,
  italicsCommand,
  highlightCommand,
  strikethroughCommand,
  codeInlineCommand,
  codeBlockCommand,
];

export const EditorCommandsDropdown = ({
  value,
  onSelect,
  caretPos,
  holderRef,
}: {
  value: string | undefined;
  onSelect: (res: ICommand) => void;
  caretPos: Pos | undefined;
  holderRef: MutableRefObject<HTMLDivElement | null>;
}) => {
  const handleClick = useCallback(
    (command: ICommand) => {
      onSelect(command);
    },
    [onSelect],
  );

  const handleTabOrEnterPress = useCallback(
    (e, item) => {
      if (value !== undefined) {
        e.preventDefault();
        if (item) {
          onSelect(item);
        }
      }
    },
    [onSelect, value],
  );

  const filteredCommands = useMemo(
    () =>
      value
        ? commands.filter(({ title }) => {
            return title.toLowerCase().includes(value.toLowerCase());
          })
        : commands,
    [value],
  );

  return filteredCommands.length > 0 ? (
    <EditorDropdown
      items={filteredCommands}
      holderRef={holderRef}
      onClick={handleClick}
      onTabOrEnterPress={handleTabOrEnterPress}
      caretPos={caretPos}
    />
  ) : null;
};
