import { Autowired, Injectable } from '@opensumi/di';
import { IOpener, URI, IRange } from '@opensumi/ide-core-browser';

import { WorkbenchEditorService, ResourceService } from '../common';

@Injectable()
export class EditorOpener implements IOpener {
  @Autowired(ResourceService)
  resourceService: ResourceService;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  async open(uri: URI) {
    let range: IRange | undefined;
    const match = /^L?(\d+)(?:,(\d+))?/.exec(uri.fragment);
    if (match) {
      // support file:///some/file.js#73,84
      // support file:///some/file.js#L73
      const startLineNumber = parseInt(match[1], 10);
      const startColumn = match[2] ? parseInt(match[2], 10) : 1;
      range = {
        startLineNumber,
        startColumn,
        endLineNumber: startLineNumber,
        endColumn: startColumn,
      };
      // remove fragment
      uri = uri.withFragment('');
    }
    await this.workbenchEditorService.open(uri, {
      range,
    });
    return true;
  }
  async handleURI(uri: URI) {
    // 判断编辑器是否可以打开
    return this.resourceService.handlesUri(uri);
  }
  handleScheme() {
    // 使用 handleURI 后会忽略 handleScheme
    return false;
  }
}
