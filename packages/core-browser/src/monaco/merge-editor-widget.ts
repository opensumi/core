import { URI, UriComponents } from '@opensumi/ide-core-common';

import type { ICodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import type { IEditor, IEditorModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

export interface IMergeEditorEditor extends IEditor {
  getOursEditor(): ICodeEditor;
  getResultEditor(): ICodeEditor;
  getTheirsEditor(): ICodeEditor;
  open(openMergeEditorArgs: IOpenMergeEditorArgs): Promise<void>;
}

export interface IMergeEditorInputData {
  uri: URI;
  title?: string;
  detail?: string; // 分支名
  description?: string; // commit
}

export class MergeEditorInputData implements IMergeEditorInputData {
  static from(data: string): MergeEditorInputData {
    try {
      const obj: MergeEditorInputData = JSON.parse(data);
      return new MergeEditorInputData(obj.uri, obj.title, obj.detail, obj.description);
    } catch (error) {
      throw Error('invalid MergeEditorInputData parse');
    }
  }

  private _textModel: IEditorModel;
  public get textModel(): IEditorModel {
    return this._textModel;
  }

  constructor(
    readonly uri: URI,
    readonly title?: string,
    readonly detail?: string | undefined,
    readonly description?: string | undefined,
  ) {}

  public getRaw(): IMergeEditorInputData {
    return {
      uri: this.uri,
      title: this.title,
      detail: this.detail,
      description: this.description,
    };
  }

  public toString(): string {
    return JSON.stringify({
      uri: this.uri.toString(),
      title: this.title,
      detail: this.detail,
      description: this.description,
    });
  }

  public setTextModel(model: IEditorModel): this {
    this._textModel = model;
    return this;
  }
}

export interface IOpenMergeEditorArgs {
  ancestor: {
    uri: URI;
    textModel: IEditorModel;
    baseContent: string;
  };
  input1: MergeEditorInputData;
  input2: MergeEditorInputData;
  output: {
    uri: URI;
    textModel: IEditorModel;
  };
}

interface IBaseValidateOpenArgs {
  input1: MergeEditorInputData;
  input2: MergeEditorInputData;
  output: URI;
}

interface IValidateOpenArgs extends IBaseValidateOpenArgs {
  ancestor: URI;
}

/**
 * vscode 1.69 + 版本中
 * `ancestor` 改为了 `base`
 */
interface IValidateOpenArgs2 extends IBaseValidateOpenArgs {
  base: URI;
}

export namespace IRelaxedOpenMergeEditorArgs {
  export const validate = (args: unknown): IValidateOpenArgs => {
    if (!args || typeof args !== 'object') {
      throw new TypeError('invalid argument');
    }

    const obj = args as IValidateOpenArgs | IValidateOpenArgs2;
    const ancestor = toUri((obj as IValidateOpenArgs).ancestor || (obj as IValidateOpenArgs2).base);
    const output = toUri(obj.output);
    const input1 = toInputData({
      ...obj.input1,
      title: obj.input1.title ?? 'Current',
    });
    const input2 = toInputData({
      ...obj.input2,
      title: obj.input2.title ?? 'Incoming',
    });
    return { ancestor, input1, input2, output };
  };

  export const toString = (args: IValidateOpenArgs): string => {
    const { ancestor, input1, input2, output } = args;

    return JSON.stringify({
      ancestor: ancestor.toString(),
      input1: input1.toString(),
      input2: input2.toString(),
      output: output.toString(),
    });
  };

  const toInputData = (args: unknown): MergeEditorInputData => {
    if (typeof args === 'string') {
      return new MergeEditorInputData(URI.parse(args));
    }
    if (!args || typeof args !== 'object') {
      throw new TypeError('invalid argument');
    }

    if (isUriComponents(args)) {
      return new MergeEditorInputData(URI.from(args));
    }

    const obj = args as MergeEditorInputData;
    const uri = toUri(obj.uri);
    const title = obj.title;
    const detail = obj.detail;
    const description = obj.description;
    return new MergeEditorInputData(uri, title, detail, description);
  };

  const toUri = (args: unknown): URI => {
    if (typeof args === 'string') {
      return URI.parse(args);
    } else if (args && typeof args === 'object') {
      return URI.from(args as UriComponents);
    }
    throw new TypeError('invalid argument');
  };

  const isUriComponents = (args: unknown): args is UriComponents => {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const obj = args as UriComponents;
    return (
      typeof obj.scheme === 'string' &&
      typeof obj.authority === 'string' &&
      typeof obj.path === 'string' &&
      typeof obj.query === 'string' &&
      typeof obj.fragment === 'string'
    );
  };
}
