import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { ThemeServicePath, IThemeService } from '../common/theme.service';
import { ThemeService } from './theme.service';

@Injectable()
export class ThemeModule extends NodeModule {
  providers: Provider[] = [
    { token: IThemeService, useClass: ThemeService },
  ];

  backServices = [
    {
      servicePath: ThemeServicePath,
      token: ThemeService,
    },
  ];
}
