/**
 * API OWNER 墨蛰
 */

declare module 'vscode' {

  export namespace workspace {
    /**
     * ~~Register a task provider.~~
     *
     * @deprecated Use the corresponding function on the `tasks` namespace instead
     *
     * @param type The task kind type this provider is registered for.
     * @param provider A task provider.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     */
    export function registerTaskProvider(type: string, provider: TaskProvider): Disposable;

  }

}
