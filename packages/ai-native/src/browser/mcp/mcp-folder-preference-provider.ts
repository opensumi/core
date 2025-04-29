import { Injectable } from '@opensumi/di';
import { FolderFilePreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-file-preference-provider';

@Injectable()
export class MCPFolderPreferenceProvider extends FolderFilePreferenceProvider {
  protected parse(content: string): any {
    const mcp = super.parse(content);
    if (mcp === undefined) {
      return undefined;
    }
    return { mcp: { ...mcp } };
  }

  protected getPath(preferenceName: string): string[] | undefined {
    if (preferenceName === 'mcp') {
      return [];
    }
    if (preferenceName.startsWith('mcp.')) {
      return [preferenceName.substr('mcp.'.length)];
    }
    return undefined;
  }
}
