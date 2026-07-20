# OpenSumi Design System

本目录是 OpenSumi UI 设计与实现的统一入口。它把仓库中已有的主题系统、组件库、布局约定和无障碍要求整理成可执行规范，不替代现有代码中的主题与组件实现。

## 文档结构

- [MASTER.md](./MASTER.md)：产品级设计原则、视觉方向、布局、动效与无障碍基线。
- [TOKENS.md](./TOKENS.md)：三层 token 模型、现有主题 token 映射和新增 token 规则。
- [COMPONENTS.md](./COMPONENTS.md)：通用组件状态、尺寸、交互与使用规范。
- [CONTRIBUTING.md](./CONTRIBUTING.md)：新增 UI、主题 token 和组件时的工作流与验收清单。

## 来源优先级

当文档与代码不一致时，按以下顺序判断：

1. 用户明确要求和产品需求。
2. OpenSumi 已发布的公共 API、主题兼容性和扩展协议。
3. `packages/theme/src/common/color-tokens/` 中注册的主题颜色。
4. `packages/components/` 中现有组件行为与尺寸。
5. 本目录中的设计规则。

发现不一致时，不要静默复制旧行为。应在变更中说明差异，并选择修正文档或实现。

## 使用方式

开发或评审 UI 前：

1. 阅读 [MASTER.md](./MASTER.md)。
2. 在 [TOKENS.md](./TOKENS.md) 中选择已有语义 token。
3. 优先复用 [COMPONENTS.md](./COMPONENTS.md) 对应的现有组件。
4. 按 [CONTRIBUTING.md](./CONTRIBUTING.md) 完成主题、键盘、无障碍和运行时验证。

## 当前范围

本规范覆盖 OpenSumi Web 与 Electron 桌面 IDE 工作台。移动端、营销网站和独立品牌页面不在当前规范范围内。`@opensumi/ide-components` 仍保持纯组件包边界，不应依赖 OpenSumi runtime。
