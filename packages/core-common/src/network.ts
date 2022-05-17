export namespace Schemes {
  /**
   * A schema that is used for models that exist in memory
   * only and that have no correspondence on a server or such.
   */
  export const inMemory = 'inmemory';

  /**
   * A schema that is used for setting files
   */
  export const vscode = 'vscode';

  /**
   * A schema that is used for internal private files
   */
  export const internal = 'private';

  /**
   * A walk-through document.
   */
  export const walkThrough = 'walkThrough';

  /**
   * An embedded code snippet.
   */
  export const walkThroughSnippet = 'walkThroughSnippet';

  export const http = 'http';

  export const https = 'https';

  export const file = 'file';

  export const mailto = 'mailto';

  export const untitled = 'untitled';

  export const data = 'data';

  export const command = 'command';

  export const vscodeRemote = 'vscode-remote';

  export const userData = 'vscode-userdata';

  export const userStorage = 'user_storage';
}
