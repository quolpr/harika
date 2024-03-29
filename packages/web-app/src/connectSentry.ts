import { configureScope } from '@sentry/minimal';
import type { RootPath, SimpleActionContext } from 'mobx-keystone';
import {
  ActionContextActionType,
  actionTrackingMiddleware,
  ActionTrackingResult,
  getRootPath,
  getSnapshot,
} from 'mobx-keystone';

const ACTION_BREADCRUMB_CATEGORY = 'redux.action';
const ACTION_BREADCRUMB_TYPE = 'info';
const STATE_CONTEXT_KEY = 'redux.state';

export function connectSentry(target: object) {
  const handlingMonitorAction = 0;

  const initialState = getSnapshot(target);

  let currentActionId = 0;
  const actionIdSymbol = Symbol('actionId');

  actionTrackingMiddleware(target, {
    onStart(ctx) {
      ctx.data[actionIdSymbol] = currentActionId++;
    },
    onResume(ctx) {
      // give a chance to the parent to log its own changes before the child starts
      if (ctx.parentContext) {
        log(ctx.parentContext, undefined);
      }
      log(ctx, undefined);
    },
    onSuspend(ctx) {
      log(ctx, undefined);
    },
    onFinish(ctx, ret) {
      log(ctx, ret.result);
    },
  });

  let lastLoggedSnapshot = initialState;

  function log(
    ctx: SimpleActionContext,
    result: ActionTrackingResult | undefined,
  ) {
    if (handlingMonitorAction) {
      return;
    }

    const state = getSnapshot(target);

    // ignore actions that don't change anything (unless it is a throw)
    if (state === lastLoggedSnapshot && result !== ActionTrackingResult.Throw) {
      return;
    }
    lastLoggedSnapshot = state;

    const rootPath = getRootPath(ctx.target);
    const name = getActionContextNameAndTypePath(ctx, rootPath, result);

    const copy = {
      type: name,
      path: rootPath.path,
      args: ctx.args,
    };

    configureScope((scope) => {
      if (typeof copy !== 'undefined' && copy !== null) {
        scope.addBreadcrumb({
          category: ACTION_BREADCRUMB_CATEGORY,
          data: copy,
          type: ACTION_BREADCRUMB_TYPE,
        });
      }

      if (typeof state !== 'undefined' && state !== null) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-expect-error
        scope.setContext(STATE_CONTEXT_KEY, state);
      } else {
        scope.setContext(STATE_CONTEXT_KEY, null);
      }
    });
  }

  function getActionContextNameAndTypePath(
    ctx: SimpleActionContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootPath: RootPath<any>,
    result: ActionTrackingResult | undefined,
  ) {
    const pathStr = '[/' + rootPath.path.join('/') + '] ';
    let name = pathStr + ctx.actionName;

    let args = ctx.args
      .map((a) => {
        try {
          return JSON.stringify(a);
        } catch {
          return '**unserializable**';
        }
      })
      .join(', ');

    if (args.length > 64) {
      args = args.slice(0, 64) + '...';
    }

    name += `(${args})`;

    const actionId = ctx.data[actionIdSymbol] as string | undefined;

    name += ` (id ${actionId !== undefined ? actionId : '?'}`;
    if (ctx.type === ActionContextActionType.Async) {
      name += ', async';
    }
    name += ')';

    if (result === ActionTrackingResult.Throw) {
      name += ' -error thrown-';
    }

    if (ctx.parentContext) {
      let parentName: string | undefined = undefined;

      try {
        parentName = getActionContextNameAndTypePath(
          ctx.parentContext,
          getRootPath(ctx.parentContext.target),
          undefined,
        );
      } catch {}

      if (parentName) {
        name = `${parentName} >>> ${name}`;
      }
    }

    return name;
  }
}
