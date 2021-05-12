import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { isElectronEnv } from '@ali/ide-core-common';
import { createBrowserApi } from './kaitian-browser';
import { IExtension } from '../common';
import { IRPCProtocol } from '@ali/ide-connection';

export function getAMDRequire() {
  if (isElectronEnv()) {
    return (global as any).amdLoader.require;
  } else {
    (global as any).amdLoader.require.config({
      onError: (err) => {
        throw err;
      },
    });
    return (global as any).amdLoader.require;
  }
}

export function getMockAmdLoader<T>(injector, extension: IExtension, rpcProtocol?: IRPCProtocol) {
  const _exports: { default?: any } | T = {};
  const _module = { exports: _exports };
  const _require = (request: string) => {
    if (request === 'React') {
      return React;
    } else if (request === 'ReactDOM') {
      return ReactDOM;
    } else if (request === 'kaitian-browser') {
      return createBrowserApi(injector, extension, rpcProtocol);
    }
  };
  return { _module, _exports, _require };
}

export function getWorkerBootstrapUrl(scriptPath: string, label: string, ignoreCors?: boolean): string {
  if (ignoreCors) {
    return scriptPath;
  }

  if (/^(http:)|(https:)|(file:)/.test(scriptPath)) {
    const currentUrl = String(window.location);
    const currentOrigin = currentUrl.substr(0, currentUrl.length - window.location.hash.length - window.location.search.length - window.location.pathname.length);
    if (scriptPath.substring(0, currentOrigin.length) !== currentOrigin) {
      const js = `/*${label}*/importScripts('${scriptPath}');/*${label}*/`;
      const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`;
      return url;
    }
  }
  return scriptPath;
}

export function getAMDDefine(): any {
  if (isElectronEnv()) {
    return (global as any).amdLoader.require.define;
  } else {
    return (global as any).amdLoader.define;
  }
}
