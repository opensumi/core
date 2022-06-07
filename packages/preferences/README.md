---
id: main-layout
title: 配置模块
---

Preferences 模块主要用于管理整个 IDE 配置的读取逻辑，

配置文件的目录位置可通过配置 `AppConfig` 中的 `userPreferenceDirName` 及 `workspacePreferenceDirName` 分别配置 全局配置 和 工作区配置的 `settings.json` 读取路径。

> 下面我们统一将 `.sumi` 作为我们默认的配置文件读取路径

对于全局配置，我们一般是从 `~/.sumi/settings.json` 文件中读取；

针对工作区的配置文件，我们一般是从 `${workspace_path}/.sumi/settings.json` 文件中读取，但在存在多个工作区存在的`多工作区` 项目，我们则是从 `${workspace_name}.sumi-workspace` 文件中读取；

你可以简单的通过如下方式来进行配置文件的修改，同时监听其变化：

```ts

@Injectable()
export class Demo {

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;
  ...

  // 监听配置变化事件
  this.preferenceService.onPreferencesChanged((changes) => {
    console.log('Preferences Changes: ', changes);
  });

  // 设置全局配置
  this.preferenceService.set('config.id', true, PreferenceScope.User);
  // 设置工作区配置
  this.preferenceService.set('config.id', true, PreferenceScope.Workspace);

  ...
}
```

# 贡献点

## Contribution Providers

模块定义的用于其他模块贡献的贡献点。

### PreferenceContribution

用于在框架中注册配置定义，你可以创建一个贡献点模块，在应用启动时引入该贡献点模块，来实现自定义的配置定义。

##### Example

```ts
// 定义一个 `general.language` 配置项
const preferencesSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    'general.demo': {
      type: 'string',
      default: 'zh-CN',
      description: 'Demo preference%',
    },
  },
};

@Domain(PreferenceContribution)
export class DemoPreferenceContribution implements PreferenceContribution {
  schema: PreferenceSchema = preferencesSchema;
}
```

### SettingContribution

如果你需要让你定义的配置出现在设置面板中，你还可以通过 `SettingContribution` 贡献点来定义。

##### Example

```ts
// 在 `general`  面板追加一个 `general.demo` 配置项的展示
@Domain(SettingContribution)
export class DemoSettingContribution implements SettingContribution {
  handleSettingSections(settingSections: { [key: string]: ISettingSection[] }) {
    return {
      ...settingSections,
      general: [
        {
          preferences: [
            // 原有配置项
            { id: 'general.theme', localized: 'preference.general.theme' },
            { id: 'general.icon', localized: 'preference.general.icon' },
            { id: 'general.language', localized: 'preference.general.language' },
            // 追加配置项
            { id: 'general.demo', localized: 'preference.demo' },
          ],
        },
      ],
    };
  }
}
```

模块注册的贡献点。

### Command

- `preference.open.user`: 打开用户配置文件
- `preference.open.workspace`: 打开工作区配置文件
- `core.openpreference`: 打开设置面板

### KeyBinding

- `ctrlcmd+,`: 打开设置面板

# 类

## PreferenceService

`DI token: PreferenceService`

一个简易的配置获取服务，能通过该符合获取到某个配置当前的值。

### Property

#### `ready`

```ts
ready: Promise<void>;
```

通过在模块中 `await this.preferenceService.ready` 能保障配置模块在被使用时已初始化完毕。

### Methods

#### `set()`

```ts
  /**
   * 设置一个偏好值
   * @param preferenceName 偏好名称
   * @param value 设置值
   * @param scope 目标scope级别 如 User, Workspace
   * @param resourceUri 资源路径
   * @param overrideIdentifier 一般指语言偏好设置
   */
  set(preferenceName: string, value: any, scope?: PreferenceScope, resourceUri?: string, overrideIdentifier?: string): Promise<void>;
```

用于设置某个配置在不同作用域，不同资源路径下的值

#### `get()`

```ts
  /**
   *
   * @param preferenceName  配置名称
   * @param defaultValue 默认值
   * @param resourceUri 资源路径
   * @param overrideIdentifier 一般指语言偏好设置
   */
  get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string, overrideIdentifier?: string): T | undefined;
```

支持获取某个配置在不同作用域，不同资源路径下的值

#### `onPreferencesChanged`

```ts
  onPreferencesChanged: Event<PreferenceChanges>;
```

配置变更事件，这里会获取到一个配置变更的集合。

#### `onPreferenceChanged()`

```ts
  onPreferenceChanged: Event<PreferenceChange>;
```

配置变更事件，这里会获取到一个配置的变更事件。

#### `onLanguagePreferencesChanged`

```ts
  onLanguagePreferencesChanged: Event<{overrideIdentifier: string, changes: PreferenceChanges}>;
```

语言偏好设置的变更事件。
