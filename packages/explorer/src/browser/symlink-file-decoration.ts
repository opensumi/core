import { Optinal } from '@ali/common-di';
import { IDecorationsProvider, IDecorationData } from '@ali/ide-decoration';
import { Event, Uri } from '@ali/ide-core-browser';

import { ExplorerResourceService } from './explorer-resource.service';

export class SymlinkDecorationsProvider implements IDecorationsProvider {
  readonly label = 'symbollink';

  readonly onDidChange: Event<Uri[]>;

  constructor(@Optinal() private readonly explorerResourceService: ExplorerResourceService) {
    this.onDidChange = this.explorerResourceService.refreshDecorationEvent;
  }

  provideDecorations(resource: Uri): IDecorationData | undefined {
    const status = this.explorerResourceService.getStatusKey(resource.toString());
    if (status && status.file) {
      if (status.file.filestat.isSymbolicLink) {
        return {
          letter: '⤷',
          source: status.file.filestat.uri,
          color: 'gitDecoration.ignoredResourceForeground',
          tooltip: 'Symbolic Link',
          // 保证单文件的情况下也可以取到对应的decoration
          weight: -1,
          bubble: !status.file.filestat.isDirectory,
        } as IDecorationData;
      }
    }
    return undefined;
  }
}
