# Kaitian IDE Electron 实践层

## Electron 版本运行步骤
```shell
cd ../../
tnpm i
tnpm run init

cd tools/electron
tnpm i
tnpm run link-local
tnpm run build
tnpm run rebuild-native -- --force-rebuild=true
tnpm run start
```

## 如何开发

首先需要在根目录执行一次 `build`，然后 `watch`。

```bash
tnpm run build
tnpm run watch
```

然后打开当前文件夹，执行：

```bash
tnpm run watch:browser
# ... 或者其他的你需要 watch 的层
```

然后再开一个终端，进行：

```bash
tnpm run start
```

打开编辑器之后，当代码有新改动时，打开编辑器内的命令行：<kbd>shift</kbd>+<kbd>command</kbd>+<kbd>p</kbd>，输入 `Reload Window` 即可看到新变化。
