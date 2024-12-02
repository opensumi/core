---
id: notebook
title: Jupyter Notebook 功能模块
---

基于 [Libro](https://github.com/difizen/libro) 实现的 Jupyter Notebook 功能模块，可根据集成需求按需引入。

使用时需确保环境中已安装 [jupyter](https://jupyter.org/)，并在 jupyter 配置文件中添加以下内容：

```python
c = get_config()
c.ServerApp.allow_origin = "*"
c.ServerApp.allow_remote_access = True
c.ServerApp.allow_root = True
c.ServerApp.ip = '0.0.0.0'
c.IdentityProvider.token = '<YOUR_TOKEN>'
```

运行 `jupyter server` 启动服务，将服务地址配置到 `notebookServerHost` 字段、token 信息填到 `notebookServerToken` 字段即可（token 设置为空字符串时可不填）：

```typescript
renderApp(
  getDefaultClientAppOpts({
    modules: [...AIModules, NotebookModule],
    opts: {
      // ...
      notebookServerHost: 'localhost:8888',
      notebookServerToken: '<YOUR_TOKEN>',
    },
  }),
);
```

> 注：目前 Notebook 能力依赖了 antd 组件库，会导致打包体积增大较多，请按需引入。
