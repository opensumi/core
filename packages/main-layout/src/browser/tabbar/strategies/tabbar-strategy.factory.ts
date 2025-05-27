import { TabbarConfig, slotRendererRegistry } from '@opensumi/ide-core-browser/lib/react-providers';

import { BaseTabbarStrategy } from './base-tabbar.strategy';
import { BottomTabbarStrategy } from './bottom-tabbar.strategy';
import { SideTabbarStrategy } from './side-tabbar.strategy';

/**
 * Tabbar 策略工厂
 */
export class TabbarStrategyFactory {
  static createStrategy(location: string): BaseTabbarStrategy {
    // 从插槽渲染器注册表获取 tabbar 配置
    const tabbarConfig = slotRendererRegistry.getTabbarConfig(location);

    switch (location) {
      case 'panel':
        return new BottomTabbarStrategy(tabbarConfig);
      case 'view':
      case 'extendView':
        return new SideTabbarStrategy(location, tabbarConfig);
      default:
        // 默认使用侧边栏策略
        return new SideTabbarStrategy(location, tabbarConfig);
    }
  }
}
