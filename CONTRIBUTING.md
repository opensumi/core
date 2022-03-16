## How to contribute

English | [简体中文](./CONTRIBUTING-zh_CN.md)

There are many ways to contribute to the development of the `OpenSumi` code. For example: write down a issue about the bug you found, submit a PR (Pull Requests), or you just want to raise some suggestions to certain features, etc. We welcome all kinds of contribution.  

After you clone and build our warehouse code, check [Issues](https://github.com/opensumi/core/issues). For issues marked with `PR Welcome`, it is best to submit your first PR If you have any questions in the process, you can always consult any project member in the comment area @ any project member.

## Development environment preparation

> The system tool installation method here refers to the [How-to-Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) document of VS Code for translation, and you can directly view the document.

Before developing the code, you need to install some necessary development tools, clone our project code [opensumi/core](https://github.com/opensumi/core), and install dependencies through `npm`.

You may need the following development tools:

- [Git](https://git-scm.com)
- [Node.JS](https://nodejs.org/en/), **x64**, version number `>= 12.x`, `<= 14.x`
- [Python](https://www.python.org/downloads/) (pre-dependency of node-gyp library; view [node-gyp readme](https://github.com/nodejs/node-gyp# installation) Find a suitable version currently supported)
  - **Note:** Windows users will install Python automatically by installing the npm module of `windows-build-tools`, which can be quickly installed in this way. (See below)
- A C/C++ compilation tool suitable for your system:
  - **macOS**
    - Installing [Xcode](https://developer.apple.com/xcode/downloads/) and its command line tools will automatically install `gcc`, the installation process relies on the `make` tool chain
      - Run `xcode-select --install` to install command line tools
  - **Windows 10/11**
    - Install Windows Build Tools:
      - If you install it through the Node installer provided by [Node.JS](https://nodejs.org/en/download/) and make sure you install the native module tools, the environment will be able to be used normally.
      - If you manage scripts through Node version, such as [nvm](https://github.com/coreybutler/nvm-windows) or [nvs](https://github.com/jasongin/nvs)
        - Install the Python version corresponding to the current version [Microsoft Store Package](https://docs.python.org/3/using/windows.html#the-microsoft-store-package)
        - Install `Visual C++ Build Environment`: Visit and install [Visual Studio Build Tools](https://visualstudio.microsoft.com/zh-hans/thank-you-downloading-visual-studio/?sku=BuildTools) or [ Visual Studio Community Edition](https://visualstudio.microsoft.com/zh-hans/thank-you-downloading-visual-studio/?sku=Community). The minimal installation mode is to install only `Desktop Development with C++`
        - Open the command line and execute `npm config set msvs_version 2019`
    - Note: Make sure that your local PATH contains only ASCII characters, otherwise it may cause [node-gyp usage problems (nodejs/node-gyp/ issues#297)](https://github.com/nodejs/node-gyp/issues/297), and currently does not currently support the construction and debugging of the project under the lower version of the Windows environment.

## Troubleshooting

In the actual development process, you may encounter issues such as `node-gyp` and other dependencies that become invalid due to NodeJS version switching. You can run `yarn rebuild:node` in the framework to rebuild the native dependencies.

## Build and run

If you want to learn how to run OpenSumi or want to debug an issue, you need to get the code locally, build it, and then run it

### Getting the sources

In the first step, you need to fork a copy of the `OpenSumi` repository, and then clone it locally:

```bash
$ git clone https://github.com/<<<your-github-account>>>/core.git
```

Usually you need to synchronize the latest branch code in advance before modifying or submitting the code.

```bash
$ cd core
$ git checkout main
$ git pull https://github.com/opensumi/core.git main
```

After handling the code conflicts, submit the code to your warehouse, and then you can go to [opensumi/core](https://github.com/opensumi/core/pulls) to submit your PR at any time.

Note: The default `opensumi/core` also contains a lot of GitHub Actions. If you don't want to execute these Actions, you can go to `https://github.com/<<Your Username>>/core/settings/actions` Close the corresponding Actions.

### Build

Build project as follows:

```bash
$ cd core
$ npm install
$ npm run init
```

### Run

After the initialization is complete, you can run the Web version directly with the following command, and enable `Hot Reload` at the same time. All modifications except the plug-in process can be seen in the Web in real time.

```bash
$ npm start
```

By default, the framework will display the `tools/workspace` directory under the project as the workspace directory. You can also open OpenSumi by specifying the path with `MY_WORKSPACE=`, as shown below:

```bash
$ MY_WORKSPACE={workspace_path} npm start
```

![perview](https://img.alicdn.com/imgextra/i2/O1CN01RkgC7P1zhGC1IgghU_!!6000000006745-2-tps-2930-1802.png)

## Debug

There are multiple processes when OpenSumi is running. You need to determine the specific process you want to debug before you can debug it in a targeted manner.

### Browser process

For the `Browser process`, you can debug directly through `Chrome Developer Tools` (recommended), or install [Debugger for Chrome](https: //marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome) to debug the breakpoint of the `Browser process`. as the picture shows:

![](https://img.alicdn.com/imgextra/i2/O1CN01RytoAv1zgLMg9FCna_!!6000000006743-2-tps-2602-1732.png#id=YcHEw&originHeight=1732&originWidth=2602&originalType=binary&ratio=1&status=done&style=none&style=

### Node process

For the `Node process`, after you run the framework through `npm start`, you can use `VSCode` or the IDE debug panel built based on OpenSumi to make a breakpoint of the `Node process` by using `Attach to BackEnd` debugging.

![](https://img.alicdn.com/imgextra/i3/O1CN014Or5e01CFOtP5rM44_!!6000000000051-2-tps-2828-1760.png#id=fYIYf&originHeight=1760&originWidth=2828&originalType=binary&ratio=1&status=done&style=none&style)

In addition, you can also use the `Launch Backend` and `Launch Frontend` of the debug panel to start the `Node process` and `Browser process` respectively for debugging.

### Plug-in process

For the `plug-in process`, you can use `VSCode` or the `Attach to Extension Host` method in the debugging panel built on OpenSumi to debug the `plug-in process`. Occasionally, you can directly open the `chrome://inspect` panel for code debugging (it is easier to use). You can get the debugging after the framework is running by filling in `localhost:9999` in the discovery port The process is debugged, as shown in the following figure:

![](https://img.alicdn.com/imgextra/i4/O1CN01qr67Fb1LCxJsM9S8p_!!6000000001264-2-tps-2500-1412.png#id=MrtyW&originHeight=1412&originWidth=2500&originalType=binary&ratio=1&status=done&style)

## PR rules

Each commit should be as small as possible, and you need to fill in your commit information in accordance with [ng4's submission specifications](https://www.npmjs.com/package/@commitlint/config-conventional#type-enum).

For example, you fixed the variable acquisition problem of the debug module, and the submission information can be as follows:

```
fix: Fix the abnormal problem of variable acquisition under the debug panel
```

For PR content, just follow the PR and fill in the template. See: [New Merge Request](https://code.alipay.com/OpenSumi/ide-framework/pull_requests/new)

## Plug-in debugging

If you want to debug the plug-in under the OpenSumi framework, you can link your local plug-in to the `{ide-framework}/tools/extensions` directory in the form of a soft link, such as:

```bash
$ ln -s {local_path}/{extension_name} {ide-framework}/tools/extensions/{extension_name}
```

You can quickly preview the effect of the plug-in function by refreshing the page.

## Feedback

We are happy to receive suggestions and functional requirements for the OpenSumi framework. Please submit and elaborate on [Issues](https://github.com/opensumi/core/issues).
