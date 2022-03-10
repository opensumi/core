import React from 'react';
import ReactDOM from 'react-dom';

import { Domain } from '@opensumi/ide-core-browser';

import {
  IBrowserRequireInterceptorArgs,
  IRequireInterceptorService,
  RequireInterceptorContribution,
} from '../common/require-interceptor';

import { createBrowserApi } from './sumi-browser';

@Domain(RequireInterceptorContribution)
export class BrowserRequireInterceptorContribution implements RequireInterceptorContribution {
  registerRequireInterceptor(registry: IRequireInterceptorService<IBrowserRequireInterceptorArgs>): void {
    registry.registerRequireInterceptor({
      moduleName: 'React',
      load: () => React,
    });

    registry.registerRequireInterceptor({
      moduleName: 'ReactDOM',
      load: () => ReactDOM,
    });

    registry.registerRequireInterceptor({
      moduleName: 'kaitian-browser',
      load: (request) => createBrowserApi(request.injector, request.extension, request.rpcProtocol),
    });
  }
}
