import { useObservable, useObservableEagerState } from 'observable-hooks';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export const useTable = <TState>(input: {
  observe: () => Observable<TState>;
}): TState => {
  return useTableCustomSwitch((n) => n[0].observe(), [input]);
};

export const useTableCustomSwitch = <TOutputs, TInputs extends Array<any>>(
  switcher: (inputs: TInputs) => Observable<TOutputs>,
  inputs: TInputs
): TOutputs => {
  const observing$ = useObservable(
    (inputs$) => inputs$.pipe(switchMap(switcher)),
    inputs
  );

  return useObservableEagerState(observing$);
};
