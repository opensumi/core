import { NodeModule, ConstructorOf} from '@ide-framework/ide-core-node';
import { ServerCommonModule } from '@ide-framework/ide-core-node';
import { FileServiceModule } from '@ide-framework/ide-file-service/lib/node';

import { ProcessModule } from '@ide-framework/ide-process';

import { FileSearchModule } from '@ide-framework/ide-file-search';
import { SearchModule } from '@ide-framework/ide-search';
import { TerminalNodePtyModule } from '@ide-framework/ide-terminal-next/lib/node';
import { LogServiceModule } from '@ide-framework/ide-logs/lib/node';
import { ExtensionModule } from '@ide-framework/ide-extension/lib/node';
import { OpenVsxExtensionManagerModule } from '@ide-framework/ide-extension-manager';
import { FileSchemeNodeModule } from '@ide-framework/ide-file-scheme/lib/node';
import { AddonsModule } from '@ide-framework/ide-addons/lib/node';

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

  AddonsModule,
];
