# ide-framework

一款通用好拓展，自定义能力强的 IDE 框架工具。

## Badges

[![Build status][build-status-image]][aone-ci-url]
[![Line coverage][line-coverage-image]][aone-ci-url]
[![Branch coverage][branch-coverage-image]][aone-ci-url]

[aone-ci-url]: https://aone-api.alibaba-inc.com/ak/testservice/api/badge/link?repo=git@gitlab.alibaba-inc.com:kaitian/ide-framework.git
[build-status-image]: https://aone-api.alibaba-inc.com/ak/testservice/api/badge/query?repo=git@gitlab.alibaba-inc.com:kaitian/ide-framework.git&type=%E6%9E%84%E5%BB%BA%E7%8A%B6%E6%80%81
[line-coverage-image]: https://aone-api.alibaba-inc.com/ak/testservice/api/badge/query?repo=git@gitlab.alibaba-inc.com:kaitian/ide-framework.git&type=%E5%8D%95%E6%B5%8B%E8%A1%8C%E8%A6%86%E7%9B%96%E7%8E%87
[branch-coverage-image]: https://aone-api.alibaba-inc.com/ak/testservice/api/badge/query?repo=git@gitlab.alibaba-inc.com:kaitian/ide-framework.git&type=%E5%8D%95%E6%B5%8B%E5%88%86%E6%94%AF%E8%A6%86%E7%9B%96%E7%8E%87

--------------------

## 项目研发
### 基本准备
安装项目依赖，并且使用 lerna 把子项目的依赖全部展开并且自动 link 内部依赖。

```bash
tnpm install
npm run init

# 下载插件, 可选
npm run download-extension
```

### 创建模块
创建一个目录叫 `file-tree` 的子模块，内部会自动将模板代码创建出来，并且有一个 name 叫 `@ali/ide-file-tree` 的模块。

```
npm run create file-tree
```

### 运行模块
运行 `file-tree` 目录下面的模块的 `example`，这里会自动去寻找目录下的 `package.json`，得到模块名之后，使用 `lerna run` 执行命令。 

```
npm run start file-tree
```

### 安装依赖
由于前端依赖和后端依赖的管理模式不一样，所以添加依赖的方式也不一样，分别有两个命令去添加依赖。

```
npm run add:node file-tree lodash
npm run add:browser file-tree lodash
```

## 发布版本

### 发布前准备

在发布之前，需要在本地进行账号登录，`tnpm login`，账号使用 ide-admin，密码由共建小组的发布管理员持有：
- 上坡
- 吭头
- 常浅

由于我们使用统一的虚拟账号去进行发布，需要把个人域账号和虚拟账号进行授权，在增加发布管理员的时候，需要联系 @死月 添加账号。

> 更新 tnpm 相关的文档在 https://web.npm.alibaba-inc.com/ 查看。

### 发布流程
代码的整体研发和版本管理分三个阶段

#### 1. 功能研发
在开发阶段，大家的代码都向 develop 分支发起代码合并，主要是开发新的功能。在 develop 分支上的代码，为了能够每日看到代码结果，会每天从 develop 分支进行日常版本构建和发布。

日常构建版本使用 snapshot 作为 dist-tag，脚本代码如下，根据实际情况更改版本号：

```
npm run publish:daily -- --targetVersion=1.1.1-snapshot.`Date +%Y%m%d%H%M%S`
```

#### 2. 测试阶段
完成了一个阶段的功能研发之后，会进行一次功能封板，从 develop 切出版本分支比如 `v1.2.x`，然后从这个分支发布出测试版本。

**Alpha 版本**: 从版本分支发布的内部测试版，一般不向外部发布，会有很多Bug。一般只有测试人员使用。

```
npm run publish -- --tag=alpha --targetVersion=1.2.0-alpha.0
```

**Beta 版本**: 从版本分支发布的测试版，这个阶段的版本会一直加入新的功能。在 Alpha 版之后推出，可能对外发布，用户选择性使用的版本。

```
npm run publish -- --tag=beta --targetVersion=1.2.0-beta.0
```

> 关于版本分支的版本号，需要遵守 semver 规范，严格进行版本控制。

#### 3. 正式版本阶段

测试阶段结束之后，版本分支的代码会被合并到 master 分支，然后进行正式版本的发布。

```
npm run publish
```


### 发布之后
如果发布之后想要修改或者查看 owner 信息的话，可以按照下面的命令执行

```
tnpm owner ls @ali/ide-file-tree
```


## 更多文档
- 研发规范: https://yuque.antfin-inc.com/zymuwz/tk8q9r/ltgiyp
- git 分支和提交管理: https://yuque.antfin-inc.com/zymuwz/stxo68/asp0ag
- merge request 模块: [链接](/merge_request_template.md)
- [changelog 文档](https://yuque.antfin-inc.com/zymuwz/ezg0nz)
