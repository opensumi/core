import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMClient from 'react-dom/client';

import { Domain } from '@opensumi/ide-core-browser';

import {
  IBrowserRequireInterceptorArgs,
  IRequireInterceptorService,
  RequireInterceptorContribution,
} from '../common/require-interceptor';

import { createBrowserApi } from './sumi-browser';

const reactDom16Wrapper = {
  ...ReactDOM,
  ...ReactDOMClient,
};

@Domain(RequireInterceptorContribution)
export class BrowserRequireInterceptorContribution implements RequireInterceptorContribution {
  registerRequireInterceptor(registry: IRequireInterceptorService<IBrowserRequireInterceptorArgs>): void {
    registry.registerRequireInterceptor({
      moduleName: 'React',
      load: () => React,
    });

    // compatible with react-dom v16
    registry.registerRequireInterceptor({
      moduleName: 'ReactDOM',
      load: () => reactDom16Wrapper,
    });

    registry.registerRequireInterceptor({
      moduleName: 'ReactDOMClient',
      load: () => ReactDOMClient,
    });

    registry.registerRequireInterceptor({
      moduleName: 'kaitian-browser',
      load: (request) => createBrowserApi(request.injector, request.extension, request.rpcProtocol),
    });

    registry.registerRequireInterceptor({
      moduleName: 'sumi-browser',
      load: (request) => createBrowserApi(request.injector, request.extension, request.rpcProtocol),
    });
  }
}
