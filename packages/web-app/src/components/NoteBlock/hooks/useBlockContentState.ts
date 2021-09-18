import { ScopedBlock } from '@harika/web-core';
import { parse } from '@harika/web-core/src/blockParser/blockParser';
import { useEffect, useMemo, useState } from 'react';
import { usePrevious } from 'react-use';

export const useBlockContentState = (
  block: ScopedBlock,
  isEditing: boolean,
) => {
  const [editingContent, setEditingContent] = useState('');

  const wasEditing = usePrevious(isEditing);

  // useDebounce(
  //   () => {
  //     block.content.update(content);
  //   },
  //   2000,
  //   [content],
  // );

  useEffect(() => {
    if (!wasEditing && isEditing) {
      setEditingContent(block.content.value);
    }
  }, [block.content.value, isEditing, wasEditing]);

  useEffect(() => {
    if (wasEditing && !isEditing) {
      block.content.update(editingContent);
    }
  }, [block.content, editingContent, isEditing, wasEditing]);

  const editingAst = useMemo(() => {
    return parse(editingContent);
  }, [editingContent]);

  return { editingContent, setEditingContent, editingAst };
};
