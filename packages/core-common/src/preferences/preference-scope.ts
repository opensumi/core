export enum PreferenceScope {
  Default,
  User,
  Workspace,
  Folder
}

export namespace PreferenceScope {

  export function is(scope: any): scope is PreferenceScope {
    return typeof scope === 'number' && getScopes().findIndex(s => s === scope) >= 0;
  }

  export function getScopes(): PreferenceScope[] {
    return Object.keys(PreferenceScope)
      .filter(k => typeof PreferenceScope[k as any] === 'string')
      .map(v => <PreferenceScope>Number(v));
  }

  export function getReversedScopes(): PreferenceScope[] {
    return getScopes().reverse();
  }

  export function getScopeNames(scope?: PreferenceScope): string[] {
    const names: string[] = [];
    const allNames = Object.keys(PreferenceScope)
      .filter(k => typeof PreferenceScope[k as any] === 'number');
    if (scope) {
      for (const name of allNames) {
        if ((<any>PreferenceScope)[name] <= scope) {
          names.push(name);
        }
      }
    }
    return names;
  }

  // 转义 vscode 中对configuration中scope的定义
  export function fromString(strScope: string): PreferenceScope | undefined {
    switch (strScope) {
      case 'application':
        return PreferenceScope.User;
      case 'window':
        return PreferenceScope.Folder;
      case 'resource':
        return PreferenceScope.Folder;
    }
  }
}

export const DEFAULT_WORKSPACE_STORAGE_DIR_NAME = '.sumi';
