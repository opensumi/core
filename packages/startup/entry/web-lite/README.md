# 纯前端版本入口

## 目录结构

```
.
├── README.md
├── modules
│   ├── common-commands // 移植一些通用的 vscode namespace 命令
│   ├── file-provider // fs provider browser 层实现
│   ├── git-scheme // git scheme 相关实现
│   ├── kt-ext-provider // kt-ext scheme 相关实现，为纯前端版本的插件协议
│   ├── language-service // lsif/lsp
│   │   └── index.contribution.ts
│   ├── sample.contribution.ts
│   ├── scm-provider
│   │   └── index.contribution.tsx
│   ├── textmate-language-grammar // 批量注册 language/grammar
│   └── view // 视图层相关注册
├── extensions // 插件相关
│   ├── index.ts
├── service // 一些通用模块实现
│   ├── code-service // 中心化代码服务
│   ├── language-service // 简化版本的语言服务实现
│   ├── lsif-service // 中心化 lsif 服务
│   └── meta-service // 目前用来放 meta 信息，后续应升级为 IApplicationService
├── overrides // 一些纯前端版本的覆盖
│   ├── browser-file-scheme.ts // 覆盖 file-scheme 模块
│   ├── doc-client.ts
│   └── mock-logger.ts // 覆盖 logger
├── utils 放一些公共的 util
└── web-lite-module.ts // 总的入口
```

## 一些原则

**需要将对外部中心化的服务依赖抽象成依赖，然后集成时，只需要对照 interface 去实现即可**
