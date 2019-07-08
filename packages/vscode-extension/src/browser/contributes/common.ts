import { JSONSchema } from '@ali/ide-feature-extension/lib/browser';
import { Disposable, localize } from '@ali/ide-core-common';

export abstract class VscodeContributionPoint<T extends JSONSchema> extends Disposable {

  constructor(protected json: T, protected path: string) {
    super();
  }

  abstract async contribute();

}

export function replaceLocalizePlaceholder(label) {
  return label.replace(/%(.*?)%/g, localizeReplacer ) ;
}

function localizeReplacer(match, p1) {
  return localize(p1);
}
