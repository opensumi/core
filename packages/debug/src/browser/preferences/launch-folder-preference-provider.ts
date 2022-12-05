import { Injectable } from '@opensumi/di';
import { FolderFilePreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-file-preference-provider';

@Injectable()
export class LaunchFolderPreferenceProvider extends FolderFilePreferenceProvider {
  protected parse(content: string): any {
    const launch = super.parse(content);
    if (launch === undefined) {
      return undefined;
    }
    return { launch: { ...launch } };
  }

  protected getPath(preferenceName: string): string[] | undefined {
    if (preferenceName === 'launch') {
      return [];
    }
    if (preferenceName.startsWith('launch.')) {
      return [preferenceName.substr('launch.'.length)];
    }
    return undefined;
  }
}
