import { Injectable } from '@ali/common-di';
import type { ITextModel } from '@ali/monaco-editor-core/esm/vs/editor/common/model';
import { IRelativePattern } from '@ali/ide-core-common/lib/utils/glob';
import { IDisposable } from '@ali/ide-core-common';
import { LanguageFeatureRegistry } from '@ali/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';

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
  registerEvaluatableExpressionProvider(selector: SerializedDocumentFilter[], provider: EvaluatableExpressionProvider): IDisposable;

  getSupportedEvaluatableExpressionProvider(model: ITextModel): EvaluatableExpressionProvider[];

  hasEvaluatableExpressProvider(model: ITextModel): boolean;
}

export const IEvaluatableExpressionService = Symbol('IEvaluatableExpressionService');

@Injectable()
export class EvaluatableExpressionServiceImpl implements IEvaluatableExpressionService {
  getSupportedEvaluatableExpressionProvider(model: ITextModel): EvaluatableExpressionProvider[] {
    return EvaluatableExpressionRegistry.ordered(model);
  }

  registerEvaluatableExpressionProvider(selector: SerializedDocumentFilter[], provider: EvaluatableExpressionProvider): IDisposable {
    return EvaluatableExpressionRegistry.register(selector, provider);
  }

  hasEvaluatableExpressProvider(model: ITextModel): boolean {
    return EvaluatableExpressionRegistry.has(model);
  }

}
