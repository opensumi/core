import React from 'react';

import { IiconContext, IconContextProvider } from './icon';
import { warning } from './utils/warning';

type LocalizeFn = (v: string) => string;

const emptyLocalize: LocalizeFn = (v) => {
  warning(false, 'Using the default localize fn');
  return '';
};

interface ILocalizeContext {
  localize: LocalizeFn;
}

export const LocalizeContext = React.createContext<ILocalizeContext>({
  localize: emptyLocalize,
});

LocalizeContext.displayName = 'LocalizeContext';

export function LocalizeContextProvider(props: React.PropsWithChildren<{ value: ILocalizeContext }>) {
  return (
    <LocalizeContext.Provider value={props.value}>
      <LocalizeContext.Consumer>{(value) => (props.value === value ? props.children : null)}</LocalizeContext.Consumer>
    </LocalizeContext.Provider>
  );
}

type IComponentContextProps<T extends string> = IiconContext<T> & ILocalizeContext;

export function ComponentContextProvider(props: React.PropsWithChildren<{ value: IComponentContextProps<any> }>) {
  return (
    <IconContextProvider value={props.value}>
      <LocalizeContextProvider value={{ localize: props.value.localize }}>{props.children}</LocalizeContextProvider>
    </IconContextProvider>
  );
}
