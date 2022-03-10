import { TopBarModule } from 'modules/topbar';

import { AddonsModule } from '@opensumi/ide-addons/lib/node';
import { NodeModule, ConstructorOf } from '@opensumi/ide-core-node';
import { ServerCommonModule } from '@opensumi/ide-core-node';
import { ExtensionModule } from '@opensumi/ide-extension';
import { OpenVsxExtensionManagerModule } from '@opensumi/ide-extension-manager';
import { FileSchemeNodeModule } from '@opensumi/ide-file-scheme/lib/node';
import { FileSearchModule } from '@opensumi/ide-file-search';
import { FileServiceModule } from '@opensumi/ide-file-service/lib/node';
import { LogServiceModule } from '@opensumi/ide-logs/lib/node';
import { ProcessModule } from '@opensumi/ide-process';
import { SearchModule } from '@opensumi/ide-search';
import { TerminalNodePtyModule } from '@opensumi/ide-terminal-next/lib/node';

import { startServer } from './server';


export const CommonNodeModules: ConstructorOf<NodeModule>[] = [
  ServerCommonModule,
  LogServiceModule,
  FileServiceModule,
  ProcessModule,
  FileSearchModule,
  SearchModule,
  TerminalNodePtyModule,

  ExtensionModule,
  OpenVsxExtensionManagerModule,
  FileSchemeNodeModule,

  // TopBarModule, // Topbar demo
  AddonsModule,
];

startServer({
  modules: [...CommonNodeModules],
}).then(() => {
  // eslint-disable-next-line no-console
  console.log('ready');
  if (process.send) {
    process.send('ready');
  }
});
