import React from 'react';
import ReactDom from 'react-dom/client';

import { ComponentContextProvider, IIconResourceOptions } from '@opensumi/ide-components';
import { ContributionProvider, IEventBus, URI, getDebugLogger, localize } from '@opensumi/ide-core-common';

import { IClientApp } from '../browser-module';
import { DefaultLayout } from '../components/layout/default-layout';
import { ResizeEvent } from '../layout';
import { ConfigProvider } from '../react-providers/config-provider';
import { allSlot } from '../react-providers/slot';
import { LabelService } from '../services';
import { getIcon } from '../style/icon/icon';

import { ClientAppContextContribution } from './context-contribution';

export interface AppProps {
  app: IClientApp;
  main: React.ComponentType<{ callback?: () => void }>;
  callback?: () => void;
  overlays?: React.ComponentType[];
}

export function App(props: AppProps) {
  const injector = props.app.injector;
  const eventBus: IEventBus = injector.get(IEventBus);
  const labelService: LabelService = injector.get(LabelService);
  const getResourceIcon = React.useCallback(
    (uri: string, options: IIconResourceOptions) => labelService.getIcon(URI.parse(uri), options),
    [],
  );

  React.useEffect(() => {
    let lastFrame: number | null;
    const handle = () => {
      if (lastFrame) {
        window.cancelAnimationFrame(lastFrame);
      }
      lastFrame = window.requestAnimationFrame(() => {
        lastFrame = null;
        allSlot.forEach((item) => {
          eventBus.fire(new ResizeEvent({ slotLocation: item.slot }));
          eventBus.fireDirective(ResizeEvent.createDirective(item.slot));
        });
      });
    };
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('resize', handle);
    };
  }, []);

  return (
    <ComponentContextProvider value={{ getIcon, localize, getResourceIcon }}>
      <ConfigProvider value={props.app.config}>
        {<props.main callback={props.callback} />}
        {props.overlays && props.overlays.map((Component, index) => <Component key={index} />)}
      </ConfigProvider>
    </ComponentContextProvider>
  );
}

export type IAppRenderer = (app: (props: any) => JSX.Element) => void;

const defaultAppRender =
  (dom: HTMLElement): IAppRenderer =>
  (IDEApp: (props: any) => JSX.Element) => {
    const root = ReactDom.createRoot(dom);
    root.render(<IDEApp />);
  };

const debugLogger = getDebugLogger();

export function renderClientApp(app: IClientApp, container: HTMLElement | IAppRenderer) {
  let Layout = app.config.layoutComponent || DefaultLayout;
  const overlayComponents = app.browserModules
    .filter((mod) => mod.isOverlay)
    .map((mod) => {
      if (!mod.component) {
        debugLogger.warn('Overlay module does not have component', mod);
        return null;
      }
      return mod.component;
    })
    .filter(Boolean) as React.ComponentType[];

  const injector = app.injector;
  const clientAppContextContribution: ContributionProvider<ClientAppContextContribution> =
    injector.get(ClientAppContextContribution);
  const contextContrib = clientAppContextContribution.getContributions();
  contextContrib.forEach((contextProvider) => (Layout = contextProvider.registerClientAppContext(Layout, injector)));

  const IdeApp = (props) => <App {...props} app={app} main={Layout} overlays={overlayComponents} />;

  const render = typeof container === 'function' ? container : defaultAppRender(container);

  return render(IdeApp);
}
