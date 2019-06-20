import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { defaultConfig, defaultFrontEndDependencies } from '@ali/ide-main-layout/lib/browser/default-config';
// TODO 动态引入
import '@ali/ide-main-layout/lib/browser';
import '@ali/ide-menu-bar/lib/browser';
import '@ali/ide-monaco/lib/browser';
import '@ali/ide-doc-model/lib/browser';
import '@ali/ide-status-bar/lib/browser';
import '@ali/ide-editor/lib/browser';
import '@ali/ide-file-tree/lib/browser';
import '@ali/ide-terminal/lib/browser';
import '@ali/ide-activator-bar/lib/browser';
import '@ali/ide-activator-panel/lib/browser';
import '@ali/ide-file-service/lib/browser';
import '@ali/ide-static-resource/lib/browser';
import '@ali/ide-express-file-server/lib/browser';
import '@ali/ide-language/lib/browser';
import '@ali/ide-git/lib/browser';
import '@ali/ide-bottom-panel/lib/browser';
import '@ali/ide-search/lib/browser';
import '@ali/ide-file-scheme/lib/browser';
import '@ali/ide-output/lib/browser';

renderApp(defaultConfig);
