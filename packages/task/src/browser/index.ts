import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { FolderFilePreferenceProvider } from '@opensumi/ide-preferences/lib/browser/folder-file-preference-provider';

import { ITaskService, ITaskSystem } from '../common';

import { TaskPreferencesContribution } from './task-preferences.contribution';
import { TaskFolderPreferenceProvider } from './task-preferences.provider';
import { TaskContribution } from './task.contribution';
import { TaskService } from './task.service';
import { TerminalTaskSystem } from './terminal-task-system';

@Injectable()
export class TaskModule extends BrowserModule {
  providers: Provider[] = [
    TaskContribution,
    TaskPreferencesContribution,
    {
      token: FolderFilePreferenceProvider,
      useClass: TaskFolderPreferenceProvider,
      dropdownForTag: true,
      tag: 'tasks',
    },
    {
      token: ITaskService,
      useClass: TaskService,
    },
    {
      token: ITaskSystem,
      useClass: TerminalTaskSystem,
    },
  ];
}
