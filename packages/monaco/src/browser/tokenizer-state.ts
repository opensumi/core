import {StackElement} from 'vscode-textmate';

/**
 * NOTE from https://github.com/NeekSandhu/monaco-editor-textmate/blob/master/src/index.ts
 */
export default class TokenizerState implements monaco.languages.IState {
  constructor(
    private _ruleStack: StackElement | null,
  ) { }

  get ruleStack() {
    return this._ruleStack;
  }

  /**
   * 复制分词器状态
   */
  clone(): TokenizerState {
    return new TokenizerState(this._ruleStack);
  }

  /**
   * 判断两个分词状态是否一致
   * @param other 另一个分词状态
   */
  equals(other: monaco.languages.IState) {
    if (!other ||
      !(other instanceof TokenizerState) ||
      other !== this ||
      other._ruleStack !== this._ruleStack
    ) {
        return false;
    }
    return true;
  }
}
