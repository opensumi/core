# Collaboration Module 协同编辑模块

> Make OpenSumi Collaborative

## 如何使用

只需在 browser 与 node app 的 startup 上添加该模块，并实现`CollaborationModuleContribution`即可使用。

## 平台支持

目前的实现只支持 Cloud IDE 场景 (Browser + Node)

## 当前限制

- 仅支持了 IDE **编辑器部分**的协同编辑功能
- 暂时仅支持在编辑器编辑文件，未处理外部对 IDE 工作区文件的修改（如 `git pull`, 用其他软件修改了文件内容）
- 未支持 browser-only 与 electron 平台

## Thanks

[yjs -- Shared data types for building collaborative software](https://github.com/yjs/yjs)

[y-websocket -- Websocket Connector for Yjs](https://github.com/yjs/y-websocket)
