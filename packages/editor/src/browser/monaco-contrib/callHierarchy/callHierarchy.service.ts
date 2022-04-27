import { Injectable, Autowired } from '@opensumi/di';
import {
  CancellationToken,
  IDisposable,
  IPosition,
  isFunction,
  arrays,
  RefCountedDisposable,
  onUnexpectedExternalError,
  URI,
  Uri,
} from '@opensumi/ide-core-common';
import {
  CallHierarchyItem,
  CallHierarchyProvider,
  CallHierarchyProviderRegistry,
  ICallHierarchyService,
  IncomingCall,
  OutgoingCall,
} from '@opensumi/ide-monaco/lib/browser/contrib/callHierarchy';
import { ITextModel, Position } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { IEditorDocumentModelService } from '../../doc-model/types';

const { isNonEmptyArray } = arrays;

declare type ProviderResult<T> = T | undefined | null | Thenable<T | undefined | null>;
/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib/callHierarchy/common/callHierarchy.ts

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
      new RefCountedDisposable(session),
    );
  }

  readonly root: CallHierarchyItem;

  private constructor(
    readonly id: string,
    readonly provider: CallHierarchyProvider,
    readonly roots: CallHierarchyItem[],
    readonly ref: RefCountedDisposable,
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

  async resolveIncomingCalls(item: CallHierarchyItem, token: CancellationToken): Promise<IncomingCall[]> {
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

  async resolveOutgoingCalls(item: CallHierarchyItem, token: CancellationToken): Promise<OutgoingCall[]> {
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

@Injectable()
export class CallHierarchyService implements ICallHierarchyService {
  @Autowired(IEditorDocumentModelService)
  protected readonly modelService: IEditorDocumentModelService;

  private models: Map<string, CallHierarchyModel> = new Map<string, CallHierarchyModel>();

  registerCallHierarchyProvider(selector: any, provider: CallHierarchyProvider) {
    CallHierarchyProviderRegistry.register(selector, provider);
  }

  async prepareCallHierarchyProvider(resource: Uri, position: Position) {
    let textModel = this.modelService.getModelReference(URI.parse(resource.toString()))?.instance.getMonacoModel();
    let textModelReference: IDisposable | undefined;
    if (!textModel) {
      const result = await this.modelService.createModelReference(URI.parse(resource.toString()));
      textModel = result.instance.getMonacoModel();
      textModelReference = result;
    }

    try {
      const model = await CallHierarchyModel.create(textModel, position, CancellationToken.None);
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
      if (isFunction(textModel?.dispose)) {
        textModel.dispose();
      }
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
