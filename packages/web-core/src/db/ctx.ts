let currentCtx: any | undefined;
export const shareCtx = <T extends any, C extends any>(
  func: () => T,
  ctx: C,
) => {
  const prevCtx = currentCtx;
  currentCtx = ctx;

  const result = func();

  currentCtx = prevCtx;

  return result;
};

export const getCtxStrict = <C extends any>(): C => {
  if (currentCtx === undefined) throw new Error('Ctx not set!');

  return currentCtx;
};
