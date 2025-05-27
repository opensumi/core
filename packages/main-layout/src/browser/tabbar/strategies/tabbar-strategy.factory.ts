import { BaseTabbarStrategy } from './base-tabbar.strategy';
import { BottomTabbarStrategy } from './bottom-tabbar.strategy';
import { SideTabbarStrategy } from './side-tabbar.strategy';

/**
 * Tabbar 策略工厂
 */
export class TabbarStrategyFactory {
  static createStrategy(location: string): BaseTabbarStrategy {
    switch (location) {
      case 'panel':
        return new BottomTabbarStrategy();
      case 'view':
      case 'extendView':
        return new SideTabbarStrategy(location);
      default:
        // 默认使用侧边栏策略
        return new SideTabbarStrategy(location);
    }
  }
}
