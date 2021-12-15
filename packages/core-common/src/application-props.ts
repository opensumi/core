/**
 * 应用基础配置类型.
 */
export interface ApplicationConfig {
  readonly [key: string]: any;
}

/**
 * 前端应用配置
 * 下列的属性在页面启动时会注入到`index.html`中的window对象中
 */
export interface ClientAppConfig extends ApplicationConfig {
  /**
   * 默认主题
   */
  readonly defaultTheme?: string;

  /**
   * 应用名称
   */
  readonly applicationName: string;

  /**
   * 默认内部的 uriScheme，用于桌面版 app 的唤起
   * 也默认为 vscode.env.uriScheme 的值
   */
  readonly uriScheme: string;
}
