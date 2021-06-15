import { Injectable, Autowired } from '@ali/common-di';
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ProviderResult } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import type { ITextModel } from '@ali/monaco-editor-core/esm/vs/editor/common/model';
import { LanguageFeatureRegistry } from '@ali/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';
import { Position } from '@ali/monaco-editor-core/esm/vs/editor/common/core/position';
import { isNonEmptyArray } from '@ali/monaco-editor-core/esm/vs/base/common/arrays';
import { onUnexpectedExternalError } from '@ali/monaco-editor-core/esm/vs/base/common/errors';
import { IDisposable } from '@ali/monaco-editor-core/esm/vs/base/common/lifecycle';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { URI, IPosition, CancellationToken } from '@ali/ide-core-common';
import { CallHierarchyProvider, CallHierarchyItem, IncomingCall, OutgoingCall } from '../../common';
export const CallHierarchyProviderRegistry = new LanguageFeatureRegistry<CallHierarchyProvider>();

class RefCountedDisposabled {
  constructor(
    private readonly _disposable: IDisposable,
    private _counter = 1,
  ) {}

  acquire() {
    this._counter++;
    return this;
  }

  release() {
    if (--this._counter === 0) {
      this._disposable.dispose();
    }
    return this;
  }
}

export interface ICallHierarchyService {
  registerCallHierarchyProvider: (selector: any, provider: CallHierarchyProvider) => void;

  prepareCallHierarchyProvider: (resource: URI, position: Position) => Promise<CallHierarchyItem[]>;

  provideIncomingCalls: (item: CallHierarchyItem) => ProviderResult<IncomingCall[]>;

  provideOutgoingCalls: (item: CallHierarchyItem) => ProviderResult<OutgoingCall[]>;
}

export const ICallHierarchyService = Symbol('ICallHierarchyService');

@Injectable()
export class CallHierarchyService implements ICallHierarchyService {

  @Autowired(IEditorDocumentModelService)
  protected readonly modelService: IEditorDocumentModelService;

  private models: Map<string, CallHierarchyModel> = new Map<string, CallHierarchyModel>();

  registerCallHierarchyProvider(selector: any, provider: CallHierarchyProvider) {
    CallHierarchyProviderRegistry.register(selector, provider);
  }

  async prepareCallHierarchyProvider(resource: URI, position: Position) {
    let textModel = this.modelService.getModelReference(resource)?.instance.getMonacoModel();
    let textModelReference: IDisposable | undefined;
    if (!textModel) {
      const result = await this.modelService.createModelReference(resource);
      textModel = result.instance.getMonacoModel();
      textModelReference = result;
    }

    try {
      const model = await CallHierarchyModel.create(
        textModel,
        position,
        CancellationToken.None,
      );
      if (!model) {
        return [];
      }
      //
      this.models.set(model.id, model);
      this.models.forEach((value, key, map) => {
        if (map.size > 10) {
          value.dispose();
          this.models.delete(key);
        }
      });
      return [model.root];
    } finally {
      textModelReference?.dispose();
    }
  }

  provideIncomingCalls(item: CallHierarchyItem): ProviderResult<IncomingCall[]> {
    const model = this.models.get(item._sessionId);
    if (!model) {
      return undefined;
    }

    return model.resolveIncomingCalls(item, CancellationToken.None);
  }

  provideOutgoingCalls(item: CallHierarchyItem): ProviderResult<OutgoingCall[]> {
    const model = this.models.get(item._sessionId);
    if (!model) {
      return undefined;
    }

    return model.resolveOutgoingCalls(item, CancellationToken.None);
  }

}

export class CallHierarchyModel {
  static async create(
    model: ITextModel,
    position: IPosition,
    token: CancellationToken,
  ): Promise<CallHierarchyModel | undefined> {
    const [provider] = CallHierarchyProviderRegistry.ordered(model);
    if (!provider) {
      return undefined;
    }
    const session = await provider.prepareCallHierarchy(model, position, token);
    if (!session) {
      return undefined;
    }
    return new CallHierarchyModel(
      session.roots.reduce((p, c) => p + c._sessionId, ''),
      provider,
      session.roots,
      new RefCountedDisposabled(session),
    );
  }

  readonly root: CallHierarchyItem;

  private constructor(
    readonly id: string,
    readonly provider: CallHierarchyProvider,
    readonly roots: CallHierarchyItem[],
    readonly ref: RefCountedDisposabled,
  ) {
    this.root = roots[0];
  }

  dispose(): void {
    this.ref.release();
  }

  fork(item: CallHierarchyItem): CallHierarchyModel {
    const that = this;
    return new (class extends CallHierarchyModel {
      constructor() {
        super(that.id, that.provider, [item], that.ref.acquire());
      }
    })();
  }

  async resolveIncomingCalls(
    item: CallHierarchyItem,
    token: CancellationToken,
  ): Promise<IncomingCall[]> {
    try {
      const result = await this.provider.provideIncomingCalls(item, token);
      if (isNonEmptyArray(result)) {
        return result;
      }
    } catch (e) {
      onUnexpectedExternalError(e);
    }
    return [];
  }

  async resolveOutgoingCalls(
    item: CallHierarchyItem,
    token: CancellationToken,
  ): Promise<OutgoingCall[]> {
    try {
      const result = await this.provider.provideOutgoingCalls(item, token);
      if (isNonEmptyArray(result)) {
        return result;
      }
    } catch (e) {
      onUnexpectedExternalError(e);
    }
    return [];
  }
}
