# Extension 模块

## 目录结构说明

```js
// browser 目录
.
├── activation.service.ts // 管理和发出插件 activateEvents
├── components  // tree-view 等插件视图 node 层 API
├── extension-command-management.ts // 提供插件进程的 command 执行环境及对应的环境的 executor 的管理
├── extension-instance-management.ts // 提供插件实例的管理，负责所有插件的实例数据的聚合和查询
├── extension-management.service.ts // 提供插件管理相关底层逻辑，供 extension-manager 面板使用
├── extension-node.service.ts // 负责 node 层的插件贡献点激活和插件进程激活/销毁逻辑
├── extension-worker.service.ts // 负责 worker 层的插件贡献点激活和插件进程激活/销毁逻辑
├── extension-view.service.ts // 负责浏览器 view 层的插件贡献点及和 worker/node 进行 proxy 绑定调用等逻辑
├── extension.contribution.ts // 为插件进程提供一些贡献点逻辑
├── extension.service.ts // 提供插件进程激活的完整逻辑
├── extension.ts // Extension Instance
├── sumi // (folder) sumi 拓展的 node 层 API 和贡献点
├── sumi-browser // (folder) sumi-browser 提供的 browser 层 API 和贡献点
├── vscode  // (folder) vscode 的 node 层 API 和贡献点
    ├── builtin-commands.ts // 插件进程内置命令的 namespace
```
