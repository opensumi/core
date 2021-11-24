import { Injectable } from '@opensumi/common-di';
import { FolderPreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-preference-provider';

@Injectable()
export class LaunchFolderPreferenceProvider extends FolderPreferenceProvider {

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
