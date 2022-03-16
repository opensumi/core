import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { LanguageFeatureRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';

import { EvaluatableExpressionProvider } from '../../common/evaluatable-expression';

interface SerializedDocumentFilter {
  $serialized: true;
  language?: string;
  scheme?: string;
  // 类型不兼容
  pattern?: any;
}

const EvaluatableExpressionRegistry = new LanguageFeatureRegistry<EvaluatableExpressionProvider>();

export interface IEvaluatableExpressionService {
  registerEvaluatableExpressionProvider(
    selector: SerializedDocumentFilter[],
    provider: EvaluatableExpressionProvider,
  ): IDisposable;

  getSupportedEvaluatableExpressionProvider(model: ITextModel): EvaluatableExpressionProvider[];

  hasEvaluatableExpressProvider(model: ITextModel): boolean;
}

export const IEvaluatableExpressionService = Symbol('IEvaluatableExpressionService');

@Injectable()
export class EvaluatableExpressionServiceImpl implements IEvaluatableExpressionService {
  getSupportedEvaluatableExpressionProvider(model: ITextModel): EvaluatableExpressionProvider[] {
    return EvaluatableExpressionRegistry.ordered(model);
  }

  registerEvaluatableExpressionProvider(
    selector: SerializedDocumentFilter[],
    provider: EvaluatableExpressionProvider,
  ): IDisposable {
    return EvaluatableExpressionRegistry.register(selector, provider);
  }

  hasEvaluatableExpressProvider(model: ITextModel): boolean {
    return EvaluatableExpressionRegistry.has(model);
  }
}
