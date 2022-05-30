<p align="center">
	<a href="https://github.com/opensumi/core"><img src="https://img.alicdn.com/imgextra/i2/O1CN01dqjQei1tpbj9z9VPH_!!6000000005951-55-tps-87-78.svg" width="150" /></a>
</p>

<div align="center">
 
[![CI][ci-image]][ci-url]
[![NPM Version][npm-image]][npm-url]
[![NPM downloads][download-image]][download-url]
[![Test Coverage][test-image]][test-url]
[![CLA assistant][cla-image]][cla-url]
[![License][license-image]][license-url]
[![Discussions][discussions-image]][discussions-url]

[ci-image]: https://github.com/opensumi/core/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/opensumi/core/actions/workflows/ci.yml
[discussions-image]: https://img.shields.io/badge/discussions-on%20github-blue
[discussions-url]: https://github.com/opensumi/core/discussions
[npm-image]: https://img.shields.io/npm/v/@opensumi/ide-core-common.svg
[npm-url]: https://www.npmjs.com/package/@opensumi/ide-core-common
[download-image]: https://img.shields.io/npm/dm/@opensumi/ide-core-common.svg
[download-url]: https://npmjs.org/package/@opensumi/ide-core-common
[license-image]: https://img.shields.io/npm/l/@opensumi/ide-core-common.svg
[license-url]: https://github.com/opensumi/core/blob/main/LICENSE
[cla-image]: https://cla-assistant.io/readme/badge/opensumi/core
[cla-url]: https://cla-assistant.io/opensumi/core
[test-image]: https://codecov.io/gh/opensumi/core/branch/main/graph/badge.svg?token=07JAPLU957
[test-url]: https://codecov.io/gh/opensumi/core

</div>

<h1 align="center">OpenSumi</h1>

一款帮助你快速搭建 CloudIDE 及 桌面端 IDE 产品的底层框架。

![perview](https://img.alicdn.com/imgextra/i3/O1CN01bDhxUy1RtuCfQ1fcI_!!6000000002170-2-tps-2844-1796.png)

[English](./README.md) | 简体中文

## ⚡️ 快速开始

由于国内网络访问的问题，部分包的下载安装都会比较缓慢，建议在开始前将你的 npm 镜像切换至国内 taobao 镜像地址，或安装一个 npm 镜像切换工具用于快速切换，如 [nrm](https://www.npmjs.com/package/nrm), 手动设置方式如下：

```bash
$ npm config set registry https://registry.npmmirror.com
```

```bash
$ npm install
$ npm run init
$ npm run download-extension  # 可选
$ npm run start
```

默认情况下，框架会将项目下的 `tools/workspace` 目录作为工作区目录展现, 同时，你也可以通过下面的命令指定你要打开的工作区路径:

```bash
$ MY_WORKSPACE={local_path} npm run start
```

通常情况下，你可能还会遇到一些系统级别的环境依赖问题，你可以访问 [开发环境准备](./CONTRIBUTING-zh_CN.md#开发环境准备) 查看如何安装对应环境依赖。

## 📕 文档

请访问 [opensumi.com](https://opensumi.com/zh)

## 🔥 如何贡献

阅读我们的 [如何贡献代码](./CONTRIBUTING-zh_CN.md) 文档学习我们的开发环境配置、流程管理、编码规则等详细规则。

## 🙋‍♀️ 帮助我们

如果你希望反馈一个 Bug, 你可以直接在 [Issues](https://github.com/opensumi/core/issues) 中直接按照格式进行创建，在提供必要的复现路径和版本信息后，我们将会有相关人员进行处理。

如果你希望提交一些代码或者帮助我们优化文档，我们十分欢迎 ~ 你可以阅读详细的 [如何贡献代码](./CONTRIBUTING-zh_CN.md) 文档路径如何贡献。

同时，对于 [Issues](https://github.com/opensumi/core/issues) 中标记了 `help wanted` 或者 `good first issue` 的问题，将会比较适合作为你的第一个 PR 来提交。

## 🧑‍💻 开发者交流群

打开钉钉客户端进行扫码，群号：34355491

![dingtalk](https://img.alicdn.com/imgextra/i4/O1CN01OgyT0Y1Sp9i7gMojz_!!6000000002295-0-tps-400-467.jpg)

## 📃 协议

Copyright (c) 2019-present Alibaba Group Holding Limited, Ant Group Co. Ltd.

本项目采用 [MIT](LICENSE) 协议。

## ✨ 贡献者

❤️ 感谢你们对项目的贡献!

<a href="https://github.com/opensumi/core/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=opensumi/core" />
</a>
