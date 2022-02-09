import { customAlphabet } from 'nanoid';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useCurrentVaultApp } from '../hooks/vaultAppHooks';
import { paths } from '../paths';

export interface IStack {
  stackId: string;
  entityId: string;
}

export const FocusedStackIdContext = createContext<
  | {
      stackId: string | undefined;
      setStackId: (id: string | undefined) => void;
    }
  | undefined
>(undefined);

export const useFocusedStackIdContext = () => {
  const context = useContext(FocusedStackIdContext);

  if (!context) throw new Error('FocusedStackIdContext is not set');

  return context;
};

export const CurrentStackContext = createContext<IStack | undefined>(undefined);

export const generateStackId = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  5,
);

const stringToStack = (id: string): IStack => {
  const [stackId, entityId] = id.split('_');

  return { entityId, stackId };
};

const stringToStacks = (str: string): IStack[] => {
  return str.split('-').map((s) => stringToStack(s));
};

const stackToString = (stack: IStack) => {
  return `${stack.stackId}_${stack.entityId}`;
};

const stacksToString = (stacks: IStack[]) => {
  return stacks.map((s) => stackToString(s)).join('-');
};

export const useStacks = () => {
  const { stackIds } = useParams<{ stackIds: string }>();

  const [currentStacks, setCurrentStacks] = useState<
    { entityId: string; stackId: string }[]
  >([]);

  useEffect(() => {
    if (stackIds === undefined) {
      setCurrentStacks([]);
    } else {
      setCurrentStacks(stringToStacks(stackIds));
    }
  }, [stackIds]);

  return currentStacks;
};

export const useCurrentStack = () => {
  const val = useContext(CurrentStackContext);

  return val;
};

export const useFocusedStack = () => {
  const stacks = useStacks();
  const focusedStackContext = useFocusedStackIdContext();

  return useMemo(
    () => stacks.find((stack) => stack.stackId === focusedStackContext.stackId),
    [focusedStackContext.stackId, stacks],
  );
};

export const usePrimaryStack = (): IStack | undefined => {
  const currentStack = useCurrentStack();
  const stacks = useStacks();
  const focusedStack = useFocusedStack();

  return currentStack || focusedStack || stacks[stacks.length - 1];
};

export const useStackPath = (
  pathGenerator: (stackString: string) => string,
) => {
  const currentStack = usePrimaryStack();
  const stacks = useStacks();

  return useCallback(
    (nextEntityId: string, openStacked?: boolean) => {
      return pathGenerator(
        currentStack
          ? stacksToString(
              openStacked
                ? stacks.flatMap((stack) =>
                    stack.stackId === currentStack.stackId
                      ? [
                          stack,
                          {
                            entityId: nextEntityId,
                            stackId: generateStackId(),
                          },
                        ]
                      : stack,
                  )
                : stacks.map((stack) =>
                    stack.stackId === currentStack.stackId
                      ? { ...stack, entityId: nextEntityId }
                      : stack,
                  ),
            )
          : stackToString({
              entityId: nextEntityId,
              stackId: generateStackId(),
            }),
      );
    },
    [currentStack, pathGenerator, stacks],
  );
};

export const useCloseNote = (stackId: string) => {
  const vaultApp = useCurrentVaultApp();
  const stacks = useStacks();
  const navigate = useNavigate();

  return useCallback(() => {
    if (!stacks) return;

    return navigate(
      paths.vaultNotePath({
        vaultId: vaultApp.applicationId,
        stackIds: stacksToString(
          stacks.filter((stack) => stack.stackId !== stackId),
        ),
      }),
    );
  }, [navigate, stackId, stacks, vaultApp.applicationId]);
};

export const useNotePath = () => {
  const vaultApp = useCurrentVaultApp();

  const pathGenerator = useCallback(
    (stacks: string) => {
      return stacks
        ? paths.vaultNotePath({
            vaultId: vaultApp.applicationId,
            stackIds: encodeURI(stacks),
          })
        : '';
    },
    [vaultApp.applicationId],
  );

  return useStackPath(pathGenerator);
};

export const useHandleNoteClickOrPress = (
  nextNoteId?: string,
  forceStackOpen = false,
) => {
  const navigate = useNavigate();
  const notePath = useNotePath();

  return useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if (!nextNoteId) return;
      if (e.target !== e.currentTarget) {
        if (!(e.target instanceof HTMLElement)) return;
        if (e.target instanceof HTMLAnchorElement) return;
        if (e.target instanceof HTMLLabelElement) return;
        if (e.target instanceof HTMLInputElement) return;

        const closestLink = e.target.closest('[role="link"]');
        if (closestLink && closestLink !== e.currentTarget) return;
      }

      e.preventDefault();

      navigate(
        notePath(
          nextNoteId,
          (!forceStackOpen && e.shiftKey) || (!e.shiftKey && forceStackOpen),
        ),
      );
    },
    [forceStackOpen, navigate, nextNoteId, notePath],
  );
};
