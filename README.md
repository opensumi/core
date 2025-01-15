<p align="center">
	<a href="https://github.com/opensumi/core"><img src="https://img.alicdn.com/imgextra/i2/O1CN01dqjQei1tpbj9z9VPH_!!6000000005951-55-tps-87-78.svg" width="150" /></a>
</p>

<h1 align="center">OpenSumi</h1>

<p align="center">A framework helps you quickly build AI Native IDE products.</p>

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

[Changelog](./CHANGELOG.md) · [Report Bug][github-issues-url] · [Request Feature][github-issues-url] · English · [中文](./README-zh_CN.md)

</div>

![perview](https://img.alicdn.com/imgextra/i3/O1CN01UUnvG21foKD7RAw9n_!!6000000004053-2-tps-2400-721.png)

## 🌟 Getting Started

Here you can find some of our example projects and templates:

- [Cloud IDE](https://github.com/opensumi/ide-startup)
- [Desktop IDE - based on the Electron](https://github.com/opensumi/ide-electron)
- [CodeFuse IDE - AI IDE based on OpenSumi](https://github.com/codefuse-ai/codefuse-ide)
- [CodeBlitz - A pure web IDE Framework](https://github.com/opensumi/codeblitz)
- [Lite Web IDE - A pure web IDE on the Browser](https://github.com/opensumi/ide-startup-lite)
- [The Mini-App liked IDE](https://github.com/opensumi/app-desktop)

## ⚡️ Development

```bash
$ yarn install
$ yarn run init
$ yarn run download-extension  # Optional
$ yarn run start
```

By default, the `tools/workspace` folder in the project would be opened, or you can run the project by specifying the directory in the following way:

```bash
$ MY_WORKSPACE={local_path} yarn run start
```

Usually, you may still encounter some system-level environment dependencies. You can visit [Development Environment Preparation](./CONTRIBUTING.md#development-environment-preparation) to see how to install the corresponding environment dependencies.

## 📕 Documentation

For complete documentation: [opensumi.com](https://opensumi.com)

## 📍 ReleaseNotes & BreakingChanges

You can see all the releasenotes and breaking changes here: [CHANGELOG.md](./CHANGELOG.md).

## 🔥 Contributing

Read through our [Contributing Guide](./CONTRIBUTING.md) to learn about our submission process, coding rules and more.

## 🙋‍♀️ Want to Help?

Want to report a bug, contribute some code, or improve documentation? Excellent! Read up on our [Contributing Guidelines](./CONTRIBUTING.md) for contributing and then check out one of our issues labeled as help wanted or good first issue.

## 🧑‍💻 Needs some help?

Go to our [issues](https://github.com/opensumi/core/issues) or [discussions](https://github.com/opensumi/core/discussions) to create a topic, it will be resolved as soon as we can.

## ✨ Contributors

Let's build a better OpenSumi together.

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

We warmly invite contributions from everyone. Before you get started, please take a moment to review our [Contributing Guide](./CONTRIBUTING.md). Feel free to share your ideas through [Pull Requests](https://github.com/opensumi/core/pulls) or [GitHub Issues](https://github.com/opensumi/core/issues).

## 📃 License

Copyright (c) 2019-present Alibaba Group Holding Limited, Ant Group Co. Ltd.

Licensed under the [MIT](LICENSE) license.

This project contains various third-party code under other open source licenses.

See the [NOTICE.md](./NOTICE.md) file for more information.
