import { useObservable, useObservableEagerState } from 'observable-hooks';
import { useCallback } from 'react';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export const useTable = <TState>(input: {
  observe: () => Observable<TState>;
}): TState => {
  return useTableCustomSwitch(
    useCallback((n: [{ observe: () => Observable<TState> }]) => {
      return n[0].observe();
    }, []),
    [input]
  );
};

export const useTableCustomSwitch = <TOutputs, TInputs extends Array<any>>(
  switcher: (inputs: TInputs) => Observable<TOutputs>,
  inputs: TInputs
): TOutputs => {
  const observing$ = useObservable(
    // TODO: fix any
    useCallback((inputs$: any) => inputs$.pipe(switchMap(switcher)), [
      switcher,
    ]),
    inputs
  );

  return useObservableEagerState(observing$);
};
