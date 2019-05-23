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

```
tnpm install
npm run init
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

### 设置账号
因为 lerna 使用 npm 进行发布，所以需要直接登录到 npm 中，账号相关的信息在这里查询 https://web.npm.alibaba-inc.com/

```
npm login --registry=https://registry.npm.alibaba-inc.com
```

### 构建和发布
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
