# CONTRIBUTING

## How to start

首先将 Node 版本切换到 14，在 Node 16 下安装依赖会有一些问题。

使用 npm 进行包管理，项目目前不使用 lock 文件，锁版本的包要么用 resolution 要么写死版本。

### for 国内开发者

对于国内开发者，我们推荐你设置镜像规则：

如 `~/.npmrc`：

```sh
electron-mirror=https://npmmirror.com/mirrors/electron/
registry=https://registry.npmmirror.com/
```
