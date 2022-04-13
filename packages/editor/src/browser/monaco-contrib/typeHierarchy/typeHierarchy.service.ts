import { Injectable, Autowired } from '@opensumi/di';
import {
  CancellationToken,
  IPosition,
  IDisposable,
  isFunction,
  isNonEmptyArray,
  RefCountedDisposable,
  onUnexpectedExternalError,
  URI,
  Uri,
} from '@opensumi/ide-core-common';
import {
  TypeHierarchyItem,
  ITypeHierarchyService,
  TypeHierarchyProvider,
  TypeHierarchyProviderRegistry,
} from '@opensumi/ide-monaco/lib/browser/contrib/typeHierarchy';
import { ITextModel, Position } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { IEditorDocumentModelService } from '../../doc-model/types';

export class TypeHierarchyModel {
  static async create(
    model: ITextModel,
    position: IPosition,
    token: CancellationToken,
  ): Promise<TypeHierarchyModel | undefined> {
    const [provider] = TypeHierarchyProviderRegistry.ordered(model);
    if (!provider) {
      return undefined;
    }
    const session = await provider.prepareTypeHierarchy(model, position, token);
    if (!session) {
      return undefined;
    }
    return new TypeHierarchyModel(
      session.roots.reduce((p, c) => p + c._sessionId, ''),
      provider,
      session.roots,
      new RefCountedDisposable(session),
    );
  }

  readonly root: TypeHierarchyItem;

  private constructor(
    readonly id: string,
    readonly provider: TypeHierarchyProvider,
    readonly roots: TypeHierarchyItem[],
    readonly ref: RefCountedDisposable,
  ) {
    this.root = roots[0];
  }

  dispose(): void {
    this.ref.release();
  }

  fork(item: TypeHierarchyItem): TypeHierarchyModel {
    const that = this;
    return new (class extends TypeHierarchyModel {
      constructor() {
        super(that.id, that.provider, [item], that.ref.acquire());
      }
    })();
  }

  async provideSupertypes(item: TypeHierarchyItem, token: CancellationToken): Promise<TypeHierarchyItem[]> {
    try {
      const result = await this.provider.provideSupertypes(item, token);
      if (isNonEmptyArray(result)) {
        return result;
      }
    } catch (e) {
      onUnexpectedExternalError(e);
    }
    return [];
  }

  async provideSubtypes(item: TypeHierarchyItem, token: CancellationToken): Promise<TypeHierarchyItem[]> {
    try {
      const result = await this.provider.provideSubtypes(item, token);
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
export class TypeHierarchyService implements ITypeHierarchyService {
  @Autowired(IEditorDocumentModelService)
  protected readonly modelService: IEditorDocumentModelService;

  private models: Map<string, TypeHierarchyModel> = new Map<string, TypeHierarchyModel>();

  registerTypeHierarchyProvider(selector: any, provider: TypeHierarchyProvider) {
    TypeHierarchyProviderRegistry.register(selector, provider);
  }

  async prepareTypeHierarchyProvider(resource: Uri, position: Position) {
    let textModel = this.modelService.getModelReference(URI.parse(resource.toString()))?.instance.getMonacoModel();
    let textModelReference: IDisposable | undefined;
    if (!textModel) {
      const result = await this.modelService.createModelReference(URI.parse(resource.toString()));
      textModel = result.instance.getMonacoModel();
      textModelReference = result;
    }

    try {
      const model = await TypeHierarchyModel.create(textModel, position, CancellationToken.None);
      if (!model) {
        return [];
      }

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

  async provideSupertypes(item: TypeHierarchyItem) {
    // find model
    const model = this.models.get(item._sessionId);
    if (!model) {
      return undefined;
    }

    return model.provideSupertypes(item, CancellationToken.None);
  }

  async provideSubtypes(item: TypeHierarchyItem) {
    // find model
    const model = this.models.get(item._sessionId);
    if (!model) {
      return undefined;
    }

    return model.provideSubtypes(item, CancellationToken.None);
  }
}
