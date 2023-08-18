declare module 'vscode' {
  /**
   * A task to execute
   */
  export class Task2 extends Task {
    detail?: string;
  }

  export interface TaskPresentationOptions {
    /**
     * Controls whether the task is executed in a specific terminal group using split panes.
     */
    group?: string;
  }
}
