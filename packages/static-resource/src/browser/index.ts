import { Injectable } from '@opensumi/di';
import { warning } from '@opensumi/ide-components/lib/utils/warning';
import { BrowserModule } from '@opensumi/ide-core-browser';

export * from '@opensumi/ide-core-browser/lib/static-resource/static.definition';

/**
 * @deprecated The static-resource function has been built into the core-browser module and will be officially deprecated soon. You can safely remove the reference to this module now.
 */
@Injectable()
export class StaticResourceModule extends BrowserModule {
  constructor() {
    super();
    warning(
      false,
      'The static-resource function has been built into the core-browser module and will be officially deprecated soon. You can safely remove the reference to this module now.',
    );
  }
}
