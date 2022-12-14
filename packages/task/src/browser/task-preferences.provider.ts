import { Injectable } from '@opensumi/di';
import { FolderFilePreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-file-preference-provider';

@Injectable()
export class TaskFolderPreferenceProvider extends FolderFilePreferenceProvider {
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
