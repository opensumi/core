import { startServer } from './server';

import { NodeModule, ConstructorOf } from '@ali/ide-core-node';
import { ServerCommonModule } from '@ali/ide-core-node';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';

import { ProcessModule } from '@ali/ide-process';

import { FileSearchModule } from '@ali/ide-file-search';
import { SearchModule } from '@ali/ide-search';
import { TerminalNodePtyModule } from '@ali/ide-terminal-next/lib/node';
import { LogServiceModule } from '@ali/ide-logs/lib/node';
import { KaitianExtensionModule } from '@ali/ide-kaitian-extension';
import { ExtensionManagerModule } from '@ali/ide-extension-manager';
import { FileSchemeNodeModule } from '@ali/ide-file-scheme/lib/node';
import { AddonsModule } from '@ali/ide-addons/lib/node';
import { TopBarModule } from 'modules/topbar';

export const CommonNodeModules: ConstructorOf<NodeModule>[] = [
  ServerCommonModule,
  LogServiceModule,
  FileServiceModule,
  ProcessModule,
  FileSearchModule,
  SearchModule,
  TerminalNodePtyModule,

  KaitianExtensionModule,
  ExtensionManagerModule,
  FileSchemeNodeModule,

  // TopBarModule, // Topbar demo
  AddonsModule,
];

startServer({
  modules: [
    ...CommonNodeModules,
  ],
}).then(() => {
  console.log('ready');
  if (process.send) {
    process.send('ready');
  }
});
