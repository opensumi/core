import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { TaskContribution } from './task.contribution';
import { ITaskService, ITaskSystem, ITaskExecutor } from '../common';
import { TaskService } from './task.service';
import { TaskPreferencesContribution } from './task-preferences.contribution';
import { FolderPreferenceProvider } from '@ide-framework/ide-preferences/lib/browser/folder-preference-provider';
import { TaskFolderPreferenceProvider } from './task-preferences.provider';
import { TerminalTaskSystem, TerminalTaskExecutor } from './terminal-task-system';

@Injectable()
export class TaskModule extends BrowserModule {
  providers: Provider[] = [
    TaskContribution,
    TaskPreferencesContribution,
    {
      token: FolderPreferenceProvider,
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
