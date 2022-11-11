# Kaitian IDE Electron 实践层

## Electron 版本运行步骤

> 注意从外部的 `yarn run start:electron` 执行后不要再次执行，否则会花很多的时间进行再次依赖安装和编译，直接在 `tools/electron` 执行 `yarn run start` 即可。

```shell
cd ../../
yarn
yarn run init

cd tools/electron
yarn
yarn run link-local
yarn run build
yarn run rebuild-native -- --force-rebuild=true
yarn run start
```

## 如何开发

首先需要在根目录执行一次 `build`，然后 `watch`。

```bash
yarn run build
yarn run watch
```

然后打开当前文件夹，执行：

```bash
yarn run watch:browser
# ... 或者其他的你需要 watch 的层
```

然后再开一个终端，进行：

```bash
yarn run start
```

打开编辑器之后，当代码有新改动时，打开编辑器内的命令行：<kbd>shift</kbd>+<kbd>command</kbd>+<kbd>p</kbd>，输入 `Reload Window` 即可看到新变化。
