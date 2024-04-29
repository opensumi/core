export class CSSVarRegistry {
  private static _instance: CSSVarRegistry;
  private _registry: Map<string, string> = new Map();

  private constructor() {}

  public static instance(): CSSVarRegistry {
    if (!CSSVarRegistry._instance) {
      CSSVarRegistry._instance = new CSSVarRegistry();
    }
    return CSSVarRegistry._instance;
  }

  public register(key: string, value: string): void {
    this._registry.set(key, value);
  }

  public get(key: string): string | undefined {
    return this._registry.get(key);
  }

  public getVars(): Map<string, string> {
    return this._registry;
  }
}

const cssVarRegistry = CSSVarRegistry.instance();

export const registerCSSVar = cssVarRegistry.register.bind(cssVarRegistry);
