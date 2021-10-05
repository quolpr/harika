let currentCtx: any | undefined;
export const shareCtx = <T extends any, C extends any>(
  func: () => T,
  ctx: C,
) => {
  const prevCtx = currentCtx;
  currentCtx = ctx;

  try {
    return func();
  } finally {
    currentCtx = prevCtx;
  }
};

export const getCtxStrict = <C extends any>(): C => {
  if (currentCtx === undefined) throw new Error('Ctx not set!');

  return currentCtx;
};
