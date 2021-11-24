import { IExtension, JSONType } from '../../../common';
import { Disposable } from '@ide-framework/ide-core-common';

export const CONTRIBUTE_NAME_KEY = 'contribute_name';
export abstract class VscodeContributionPoint<T extends JSONType = JSONType> extends Disposable {

  constructor(protected json: T, protected contributes: any, protected extension: IExtension) {
    super();
  }

  abstract contribute();

}

export function Contributes(name) {
  return (target) => {
    Reflect.defineMetadata(CONTRIBUTE_NAME_KEY, name, target);
  };
}
