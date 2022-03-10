## 如何贡献

[English](./CONTRIBUTING.md) | 简体中文

一般而言，你有许多方式为 `OpenSumi` 代码建设出力，例如：写下一个你发现的 Bug 的现象及复现路径到 Issue 区反馈，提交一个 PR (Pull Requests)，又或者是单纯对某个功能提交一个建议等。我们非常欢迎你的热心相助。

在你克隆并构建完我们的仓库代码后，检查 [Issues](https://github.com/opensumi/core/issues)，对于标注了 `PR Welcome` 的问题是提交你第一个 PR 最佳的实践案例，如果你在过程中有任何疑问，也可以随时在评论区 @ 任何一位项目成员进行咨询。

## 开发环境准备

> 这里的系统工具安装方式参考了 VS Code 的 [How-to-Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) 文档进行翻译，可以直接查看该文档。

在开发代码前你需要安装必要的一些开发工具，克隆我们的项目代码 [opensumi/core](https://github.com/opensumi/core)，并且通过 `npm` 安装依赖。

由于国内墙的缘故，部分包的下载安装都会比较缓慢，建议在开始前将你的 npm 镜像切换至国内 taobao 镜像地址，或安装一个 npm 镜像切换工具用于快速切换，如 [nrm](https://www.npmjs.com/package/nrm), 手动设置方式如下：

```bash
$ npm config set registry https://registry.npmmirror.com
```

由于 `canvas` 依赖 GitHub Release 资源，在国内网络环境下极易超时，故安装依赖时请加上对应的镜像地址如下：

```bash
$ npm install --canvas_binary_host_mirror=https://npmmirror.com/mirrors/canvas/
```

你可能需要下面一些开发工具：

- [Git](https://git-scm.com)
- [Node.JS](https://nodejs.org/), **x64**, 版本号 `>= 12.x`, `<= 14.x`
  - **注意:** Windows 用户通过这种方法快速安装编译环境，不再需要重复装 Python 和 Windows Build Tools：从 Node.js 官网下载的安装包运行，勾选“Automatically install the necessary tools.”，将会自动安装 Python 和 Windows 编译工具。示意图：<img alt="示意图" src="https://img.alicdn.com/imgextra/i3/O1CN01uH4otG22z4SDCraOo_!!6000000007190-2-tps-976-760.png" width="400" />
- [Python](https://www.python.org/downloads/) (node-gyp 库的前置依赖; 查看 [node-gyp readme](https://github.com/nodejs/node-gyp#installation) 找到当前支持的合适版本)
- 一个适合你系统的 C/C++ 编译工具:
  - **macOS**
    - 安装 [Xcode](https://developer.apple.com/xcode/downloads/) 及其命令行工具将会自动安装 `gcc`，该安装过程依赖 `make` 工具链
      - 运行 `xcode-select --install` 安装命令行工具
  - **Windows 10/11**
    - 安装 Windows Build Tools:
      - 如果你是通过 [Node.JS](https://nodejs.org/en/download/) 提供的 Node 安装器安装的并确保你安装了原生模块工具，环境将会是可以正常使用的。
      - 如果你是通过 Node 版本管理脚本，如 [nvm](https://github.com/coreybutler/nvm-windows) 或者 [nvs](https://github.com/jasongin/nvs)
        - 安装当前版本对应的 Python 版本 [Microsoft Store Package](https://docs.python.org/3/using/windows.html#the-microsoft-store-package)
        - 安装 `Visual C++ Build Environment`: 访问并安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/zh-hans/thank-you-downloading-visual-studio/?sku=BuildTools) 或者 [Visual Studio Community Edition](https://visualstudio.microsoft.com/zh-hans/thank-you-downloading-visual-studio/?sku=Community)。最小化的安装模式是只安装 `Desktop Development with C++`
        - 打开命令行执行 `npm config set msvs_version 2019`
      - 如果已经装 2019 或者更高的版本，但提示找不到对应的编译工具
        - 在系统的环境变量，设置 VCINSTALLDIR 为 "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild"
        - npm config set msvs_version 2019 （可以通过 npm config list 获取设置的位置）
    - 注意：确保你本地的 PATH 中只包含 ASCII 字符，否则可能会导致 [node-gyp usage problems (nodejs/node-gyp/issues#297)](https://github.com/nodejs/node-gyp/issues/297) 问题，同时当前暂不支持更低版本 Windows 环境下对项目的构建及调试。

## 常见问题

在实际开发过程中，你可能会遇到 `node-gyp` 等依赖由于 NodeJS 版本切换导致失效的问题，你可以在框架中运行 `yarn rebuild:node` 对原生依赖进行重新构建。

## 构建和运行

如果你想了解如何运行 OpenSumi 或者想调试一个 Issue，你需要在本地获取代码，构建，然后运行它

### 获取代码

第一步，你需要先 Fork 一份 `OpenSumi` 仓库副本，然后再将其克隆到本地：

```bash
$ git clone https://github.com/<<<your-github-account>>>/core.git
```

通常你需要在修改或提交代码前提前同步一下最新的分支代码。

```bash
$ cd core
$ git checkout main
$ git pull https://github.com/opensumi/core.git main
```

处理完代码冲突，提交代码到你的仓库下，然后就可以随时到 [opensumi/core](https://github.com/opensumi/core/pulls) 提交你的 PR。

注意：默认 `opensumi/core` 下还包含了不少 GitHub Actions，如果你不想执行这些 Actions，你可以在 `https://github.com/<<Your Username>>/core/settings/actions` 下关闭掉对应 Actions。

### 构建

进入本地项目路径，通过 `npm` 安装依赖并进行依赖初始化，由于国内墙的缘故，部分包的下载安装都会比较缓慢，建议在开始前将你的 npm 镜像切换至国内 taobao 镜像地址，或安装一个 npm 镜像切换工具用于快速切换，如 [nrm](https://www.npmjs.com/package/nrm), 手动设置方式如下：

```bash
$ npm config set registry https://registry.npmmirror.com
```

由于 `canvas` 依赖 GitHub Release 资源，在国内网络环境下极易超时，故安装依赖时请加上对应的镜像地址如下：

```bash
$ cd core
$ npm install --canvas_binary_host_mirror=https://npmmirror.com/mirrors/canvas/
$ npm run init
```

### 运行

初始化完成后，你便可以通过下面命令直接运行 Web 版本，并同时启用 `Hot Reload` 除了插件进程外的修改都能够实时在 Web 中看到修改效果。

```bash
$ npm start
```

默认情况下，框架会将项目下的 `tools/workspace` 目录作为工作区目录展现，你也可以通过 `MY_WORKSPACE=` 指定路径的方式打开 OpenSumi，如下所示：

```bash
$ MY_WORKSPACE={workspace_path} npm start
```

![perview](https://img.alicdn.com/imgextra/i1/O1CN01n6girT1wJ2OmjQ15K_!!6000000006286-2-tps-2844-1830.png)

## 调试

OpenSumi 运行时存在多个进程，你需要确定你要调试的具体进程，才能针对性进行调试。

### Browser 进程

对于 `Browser 进程`，你可以直接通过 `Chrome Developer Tools` 进行调试（推荐），也可以通过在 `VSCode` 或 OpenSumi 系 IDE （如：O2、Ant Codespace 等）安装 [Debugger for Chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome) 的方式进行 `Browser 进程` 的断点调试。如图所示：

![](https://img.alicdn.com/imgextra/i2/O1CN01RytoAv1zgLMg9FCna_!!6000000006743-2-tps-2602-1732.png#id=YcHEw&originHeight=1732&originWidth=2602&originalType=binary&ratio=1&status=done&style=none)

### Node 进程

对于 `Node 进程`，在你通过 `npm start` 运行起框架后，你可以通过使用 `VSCode` 或基于 OpenSumi 搭建的 IDE 调试面板中的 `Attach to BackEnd` 的方式进行 `Node 进程` 的断点调试。

![](https://img.alicdn.com/imgextra/i3/O1CN014Or5e01CFOtP5rM44_!!6000000000051-2-tps-2828-1760.png#id=fYIYf&originHeight=1760&originWidth=2828&originalType=binary&ratio=1&status=done&style=none)

另外的，你也可以通过调试面板的 `Launch Backend` 和 `Launch Frontend` 分别启动 `Node 进程` 和 `Browser 进程` 进行调试。

### 插件进程

针对 `插件进程`，你可以通过使用 `VSCode` 或基于 OpenSumi 搭建的调试面板中的 `Attach to Extension Host` 的方式进行 `插件进程` 的断点调试。偶尔不太灵的情况，你也可以直接打开 `chrome://inspect` 面板进行代码调试（比较好用），通过在发现端口中填入 `localhost:9999` 便可以在框架运行后获取到调试进程进行调试，如下图所示：

![](https://img.alicdn.com/imgextra/i4/O1CN01qr67Fb1LCxJsM9S8p_!!6000000001264-2-tps-2500-1412.png#id=MrtyW&originHeight=1412&originWidth=2500&originalType=binary&ratio=1&status=done&style=none)

## 单元测试

单元测试我们采用 `TS-Jest` 进行单元测试，同时结合 `@opensumi/di` 中实现的 mock 能力，进行执行环境的模拟及测试。

你可以通过如下命令对某个模块（下面代码测试模块为 debug，即 packages 目录下的 debug 目录）的代码进行测试：

```bash
$ npm run test:module -- --module=debug
```

你也可以通过调试面板中的 `Jest Current File` 指令，对当前编辑器激活的调试文件进行断点调试。

## 代码规范

直接运行 `npm run lint` 可对整体代码进行规范检索，同时代码提交时也会触发相应的代码格式校验。

## 提交规范

每个 commit 应尽量小，需要按照 [ng4 的提交规范](https://www.npmjs.com/package/@commitlint/config-conventional#type-enum) 填写你的 commit 信息。

举个例子，你修复了调试模块的变量获取问题，提交信息可以如下所示：

```
fix: 修复调试面板下的变量获取异常问题
```

对于 PR 内容，遵循 PR 填写模板即可。见：[新建合并请求](https://code.alipay.com/OpenSumi/ide-framework/pull_requests/new)

## 插件调试

如果你希望在 OpenSumi 框架下对插件进行调试，你可以将你的本地插件以软链接的方式链接到 `{ide-framework}/tools/extensions` 目录下，如：

```bash
$ ln -s {local_path}/{extension_name} {ide-framework}/tools/extensions/{extension_name}
```

通过刷新页面便可以快速进行插件功能的效果预览。

## 英文拼写

对于常见的拼写问题，我们建议你在 `VSCode` 或基于 OpenSumi 搭建的 IDE 下安装 [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) 插件来避免常见的一些英文拼写问题。

## 建议及反馈

我们很乐意接收对于 OpenSumi 框架的建议及功能需求，欢迎在 [Issues](https://github.com/opensumi/core/issues) 提交并进行详细阐述。
