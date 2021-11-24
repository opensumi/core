import { Injectable } from '@opensumi/common-di';
import { FolderPreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-preference-provider';

@Injectable()
export class TaskFolderPreferenceProvider extends FolderPreferenceProvider {

  protected parse(content: string): any {
    const tasks = super.parse(content);
    if (tasks === undefined) {
      return undefined;
    }
    return { tasks: { ...tasks } };
  }

  protected getPath(preferenceName: string): string[] | undefined {
    if (preferenceName === 'tasks') {
      return [];
    }
    if (preferenceName.startsWith('tasks.')) {
      return [preferenceName.substr('tasks.'.length)];
    }
    return undefined;
  }

}
