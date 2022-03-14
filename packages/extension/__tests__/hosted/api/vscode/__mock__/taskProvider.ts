import type { TaskProvider } from 'vscode';

import { Emitter as EventEmitter, Event } from '@opensumi/ide-core-common';

import * as extTypes from '../../../../../src/common/vscode/ext-types';

// Test case
class CustomBuildTaskTerminal {
  private writeEmitter = new EventEmitter<string>();
  onDidWrite: Event<string> = this.writeEmitter.event;
  private closeEmitter = new EventEmitter<void>();
  onDidClose?: Event<void> = this.closeEmitter.event;

  private fileWatcher;

  constructor(
    private workspaceRoot: string,
    private flavor: string,
    private flags: string[],
    private getSharedState: () => string | undefined,
    private setSharedState: (state: string) => void,
  ) {}

  open(initialDimensions): void {
    this.doBuild();
  }

  close(): void {
    // The terminal has been closed. Shutdown the build.
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }

  private async doBuild(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.writeEmitter.fire('Starting build...\r\n');
      let isIncremental = this.flags.indexOf('incremental') > -1;
      if (isIncremental) {
        if (this.getSharedState()) {
          this.writeEmitter.fire('Using last build results: ' + this.getSharedState() + '\r\n');
        } else {
          isIncremental = false;
          this.writeEmitter.fire('No result from last build. Doing full build.\r\n');
        }
      }

      // Since we don't actually build anything in this example set a timeout instead.
      setTimeout(
        () => {
          const date = new Date();
          this.setSharedState(date.toTimeString() + ' ' + date.toDateString());
          this.writeEmitter.fire('Build complete.\r\n\r\n');
          if (this.flags.indexOf('watch') === -1) {
            this.closeEmitter.fire();
            resolve();
          }
        },
        isIncremental ? 1000 : 4000,
      );
    });
  }
}

export class CustomBuildTaskProvider implements TaskProvider {
  static CustomBuildScriptType = 'custombuildscript';
  private tasks: extTypes.Task[] | undefined;

  // We use a CustomExecution task when state needs to be shared accross runs of the task or when
  // the task requires use of some VS Code API to run.
  // If you don't need to share state between runs and if you don't need to execute VS Code API in your task,
  // then a simple ShellExecution or ProcessExecution should be enough.
  // Since our build has this shared state, the CustomExecution is used below.
  private sharedState: string | undefined;

  constructor(private workspaceRoot: string) {}

  public async provideTasks(): Promise<extTypes.Task[]> {
    return this.getTasks();
  }

  public resolveTask(_task: extTypes.Task): extTypes.Task | undefined {
    const flavor: string = _task.definition.flavor;
    if (flavor) {
      const definition = _task.definition as any;
      return this.getTask(definition.flavor, definition.flags ? definition.flags : [], definition);
    }
    return undefined;
  }

  private getTasks(): extTypes.Task[] {
    if (this.tasks !== undefined) {
      return this.tasks;
    }
    // In our fictional build, we have two build flavors
    const flavors: string[] = ['32', '64'];
    // Each flavor can have some options.
    const flags: string[][] = [['watch', 'incremental'], ['incremental'], []];

    this.tasks = [];
    flavors.forEach((flavor) => {
      flags.forEach((flagGroup) => {
        this.tasks!.push(this.getTask(flavor, flagGroup));
      });
    });
    return this.tasks;
  }

  private getTask(flavor: string, flags: string[], definition?: any): extTypes.Task {
    if (definition === undefined) {
      definition = {
        type: CustomBuildTaskProvider.CustomBuildScriptType,
        flavor,
        flags,
      };
    }
    return new extTypes.Task(
      definition,
      extTypes.TaskScope.Global,
      `${flavor} ${flags.join(' ')}`,
      CustomBuildTaskProvider.CustomBuildScriptType,
      new extTypes.CustomExecution(
        async (): Promise<any> =>
          new CustomBuildTaskTerminal(
            this.workspaceRoot,
            flavor,
            flags,
            () => this.sharedState,
            (state: string) => (this.sharedState = state),
          ),
      ),
    );
  }
}
