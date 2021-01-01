import {
  actionTrackingMiddleware,
  Patch,
  PatchRecorder,
  patchRecorder,
  SimpleActionContext,
} from 'mobx-keystone';

export function syncable(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  console.log(target, propertyKey, descriptor);
}

export function syncMiddleware(
  subtreeRoot: object,
  applyPatches: (patches: Patch[]) => void
) {
  interface PatchRecorderData {
    recorder: PatchRecorder;
    recorderStack: number;
    undoRootContext: SimpleActionContext;
  }

  const patchRecorderSymbol = Symbol('patchRecorder');

  function initPatchRecorder(ctx: SimpleActionContext) {
    ctx.rootContext.data[patchRecorderSymbol] = {
      recorder: patchRecorder(subtreeRoot, {
        recording: false,
      }),
      recorderStack: 0,
      undoRootContext: ctx,
    } as PatchRecorderData;
  }

  function getPatchRecorderData(ctx: SimpleActionContext): PatchRecorderData {
    return ctx.rootContext.data[patchRecorderSymbol];
  }

  const middlewareDisposer = actionTrackingMiddleware(subtreeRoot, {
    onStart(ctx) {
      if (ctx.rootContext.actionName === 'createOrUpdateNoteAndBlocksFromAttrs')
        return;
      if (!getPatchRecorderData(ctx)) {
        initPatchRecorder(ctx);
      }
    },
    onResume(ctx) {
      if (ctx.rootContext.actionName === 'createOrUpdateNoteAndBlocksFromAttrs')
        return;
      const patchRecorderData = getPatchRecorderData(ctx);
      patchRecorderData.recorderStack++;
      patchRecorderData.recorder.recording =
        patchRecorderData.recorderStack > 0;
    },
    onSuspend(ctx) {
      if (ctx.rootContext.actionName === 'createOrUpdateNoteAndBlocksFromAttrs')
        return;
      const patchRecorderData = getPatchRecorderData(ctx);
      patchRecorderData.recorderStack--;
      patchRecorderData.recorder.recording =
        patchRecorderData.recorderStack > 0;
    },
    onFinish(ctx) {
      if (ctx.rootContext.actionName === 'createOrUpdateNoteAndBlocksFromAttrs')
        return;
      const patchRecorderData = getPatchRecorderData(ctx);
      if (patchRecorderData && patchRecorderData.undoRootContext === ctx) {
        const patchRecorder = patchRecorderData.recorder;

        if (patchRecorder.events.length > 0) {
          const patches: Patch[] = [];
          const inversePatches: Patch[] = [];

          for (const event of patchRecorder.events) {
            patches.push(...event.patches);
            inversePatches.push(...event.inversePatches);
          }

          applyPatches(patches);
        }

        patchRecorder.dispose();
      }
    },
  });
}
