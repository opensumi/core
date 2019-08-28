import { URI } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

@Injectable()
export class IconService {
  @Autowired()
  staticResourceService: StaticResourceService;

  fromSVG(path: URI | string): string {
    if (typeof path === 'string') {
      path = URI.file(path);
    }
    const randomIconClass = `icon-${Math.random().toString(36).slice(-8)}`;
    const iconUrl = this.staticResourceService.resolveStaticResource(path).toString();
    const cssRule = `.${randomIconClass} {-webkit-mask: url(${iconUrl}) no-repeat 50% 50%;}`;
    let iconStyleNode = document.getElementById('plugin-icons');
    if (!iconStyleNode) {
      iconStyleNode = document.createElement('style');
      iconStyleNode.id = 'plugin-icons';
      document.getElementsByTagName('head')[0].appendChild(iconStyleNode);
    }
    iconStyleNode.append(cssRule);
    return randomIconClass + ' ' + 'mask-mode';
  }
}
