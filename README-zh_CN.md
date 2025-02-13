<p align="center">
	<a href="https://github.com/opensumi/core"><img src="https://img.alicdn.com/imgextra/i2/O1CN01dqjQei1tpbj9z9VPH_!!6000000005951-55-tps-87-78.svg" width="150" /></a>
</p>

<h1 align="center">OpenSumi</h1>

<p align="center">一款帮助你快速搭建 AI 原生 IDE 产品的底层框架。</p>

<div align="center">
 
[![CI][ci-image]][ci-url]
[![E2E][e2e-image]][e2e-url]
[![Test Coverage][test-image]][test-url]
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Issues need help][help-wanted-image]][help-wanted-url]

[![Discussions][discussions-image]][discussions-url] [![CLA assistant][cla-image]][cla-url] [![License][license-image]][license-url]

[![NPM Version][npm-image]][npm-url] [![NPM downloads][download-image]][download-url]

[![Open in CodeBlitz][codeblitz-image]][codeblitz-url]

[ci-image]: https://github.com/opensumi/core/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/opensumi/core/actions/workflows/ci.yml
[e2e-image]: https://github.com/opensumi/core/actions/workflows/e2e.yml/badge.svg
[e2e-url]: https://github.com/opensumi/core/actions/workflows/e2e.yml
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
[codeblitz-image]: https://img.shields.io/badge/Ant_Codespaces-Open_in_CodeBlitz-1677ff
[codeblitz-url]: https://codeblitz.cloud.alipay.com/github/opensumi/core
[github-issues-url]: https://github.com/opensumi/core/issues
[help-wanted-image]: https://flat.badgen.net/github/label-issues/opensumi/core/🤔%20help%20wanted/open
[help-wanted-url]: https://github.com/opensumi/core/issues?q=is%3Aopen+is%3Aissue+label%3A%22🤔+help+wanted%22

[Changelog](./CHANGELOG-zh_CN.md) · [Report Bug][github-issues-url] · [Request Feature][github-issues-url] · [English](./README.md) · 中文

</div>

![perview](https://img.alicdn.com/imgextra/i3/O1CN01UUnvG21foKD7RAw9n_!!6000000004053-2-tps-2400-721.png)

## 🌟 起步项目

我们提供了一些示例项目帮助你快速搭建你的 IDE 项目产品

- [Cloud IDE](https://github.com/opensumi/ide-startup)
- [Desktop IDE - 桌面端 IDE](https://github.com/opensumi/ide-electron)
- [CodeFuse IDE - 基于 OpenSumi 的 AI IDE](https://github.com/codefuse-ai/codefuse-ide)
- [CodeBlitz - 无容器 IDE 框架](https://github.com/opensumi/codeblitz)
- [Lite Web IDE - 无容器 IDE ](https://github.com/opensumi/ide-startup-lite)
- [小程序 IDE ](https://github.com/opensumi/app-desktop)

## ⚡️ 如何开发

由于国内网络访问的问题，部分包的下载安装都会比较缓慢，建议在开始前将你的 npm 镜像切换至国内 taobao 镜像地址，或安装一个 npm 镜像切换工具用于快速切换，如 [nrm](https://www.npmjs.com/package/nrm), 手动设置方式如下：

```bash
$ yarn config set npmRegistryServer https://registry.npmmirror.com
```

```bash
$ yarn
$ yarn run init
$ yarn run download-extension  # 可选
$ yarn run start
```

默认情况下，框架会将项目下的 `tools/workspace` 目录作为工作区目录展现, 同时，你也可以通过下面的命令指定你要打开的工作区路径:

```bash
$ MY_WORKSPACE={local_path} yarn run start
```

通常情况下，你可能还会遇到一些系统级别的环境依赖问题，你可以访问 [开发环境准备](./CONTRIBUTING-zh_CN.md#开发环境准备) 查看如何安装对应环境依赖。

## 📕 文档

请访问 [opensumi.com](https://opensumi.com/zh)

## 📍 更新日志及不兼容的变更

请访问 [CHANGELOG.md](./CHANGELOG.md).

## 🔥 如何贡献

阅读我们的 [如何贡献代码](./CONTRIBUTING-zh_CN.md) 文档学习我们的开发环境配置、流程管理、编码规则等详细规则。

## 🙋‍♀️ 帮助我们

如果你希望反馈一个 Bug, 你可以直接在 [Issues](https://github.com/opensumi/core/issues) 中直接按照格式进行创建，在提供必要的复现路径和版本信息后，我们将会有相关人员进行处理。

如果你希望提交一些代码或者帮助我们优化文档，我们十分欢迎 ~ 你可以阅读详细的 [如何贡献代码](./CONTRIBUTING-zh_CN.md) 文档路径如何贡献。

同时，对于 [Issues](https://github.com/opensumi/core/issues) 中标记了 `help wanted` 或者 `good first issue` 的问题，将会比较适合作为你的第一个 PR 来提交。

## 🧑‍💻 开发者交流群

我们建议你通过 [issues](https://github.com/opensumi/core/issues) 或 [discussions](https://github.com/opensumi/core/discussions) 与我们进行交流。

如果你希望通过即时通讯工具（如微信、钉钉）交流，欢迎前往我们的 [中文社区](https://opensumi.com/zh/community) 页面获取最新二维码信息。

## ✨ 贡献者

加入我们，一起构建更好用的 OpenSumi！

<table>
<tr>
  <td>
    <a href="https://next.ossinsight.io/widgets/official/compose-recent-top-contributors?repo_id=429104828" target="_blank" style="display: block" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-recent-top-contributors/thumbnail.png?repo_id=429104828&image_size=auto&color_scheme=dark" width="280">
        <img alt="Top Contributors of ant-design/ant-design - Last 28 days" src="https://next.ossinsight.io/widgets/official/compose-recent-top-contributors/thumbnail.png?repo_id=429104828&image_size=auto&color_scheme=light" width="280">
      </picture>
    </a>
  </td>
  <td rowspan="2">
    <a href="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats?repo_id=429104828" target="_blank" style="display: block" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=429104828&image_size=auto&color_scheme=dark" width="655" height="auto">
        <img alt="Performance Stats of ant-design/ant-design - Last 28 days" src="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=429104828&image_size=auto&color_scheme=light" width="655" height="auto">
      </picture>
    </a>
  </td>
</tr>
<tr>
  <td>
    <a href="https://next.ossinsight.io/widgets/official/compose-org-active-contributors?period=past_28_days&activity=active&owner_id=90233428&repo_ids=429104828" target="_blank" style="display: block" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-org-active-contributors/thumbnail.png?period=past_28_days&activity=active&owner_id=90233428&repo_ids=429104828&image_size=2x3&color_scheme=dark" width="273" height="auto">
        <img alt="Active participants of opensumi - past 28 days" src="https://next.ossinsight.io/widgets/official/compose-org-active-contributors/thumbnail.png?period=past_28_days&activity=active&owner_id=90233428&repo_ids=429104828&image_size=2x3&color_scheme=light" width="273" height="auto">
      </picture>
    </a>
  </td>
</tr>
</table>

在开始之前，请花点时间查看我们的[贡献指南](./CONTRIBUTING-zh_CN.md)。欢迎通过 [Pull Requests](https://github.com/opensumi/core/pulls) 或 [GitHub Issues](https://github.com/opensumi/core/issues) 分享您的想法。

## 📃 协议

Copyright (c) 2019-present Alibaba Group Holding Limited, Ant Group Co. Ltd.

本项目采用 [MIT](LICENSE) 协议。

同时，该项目也包含部分基于其他开源协议下的第三方代码，详细内容请查看 [NOTICE.md](./NOTICE.md) 文件。
