import { Provider, Injectable } from '@ide-framework/common-di';
import { NodeModule } from '@ide-framework/ide-core-node';

@Injectable()
export class TemplateUpperNameModule extends NodeModule {
  providers: Provider[] = [];
}
