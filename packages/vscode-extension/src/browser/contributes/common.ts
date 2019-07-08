import { JSONSchema } from '@ali/ide-feature-extension/lib/browser';
import { Disposable, localize } from '@ali/ide-core-common';

export const CONTRIBUTE_NAME_KEY = 'contribute_name';
export abstract class VscodeContributionPoint<T extends JSONSchema = JSONSchema> extends Disposable {

  constructor(protected json: T, protected contributes: any) {
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

export function Contributes(name) {
  return (target) => {
    Reflect.defineMetadata(CONTRIBUTE_NAME_KEY, name, target);
  };
}
