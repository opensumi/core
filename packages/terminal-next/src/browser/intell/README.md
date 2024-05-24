## 终端的智能补全能力

终端的智能补全能力是指终端在输入命令时，能够根据用户的输入，自动提示可能的命令或参数，交互方式类似于编程时的语言服务。 

此功能可以增加用户使用终端时的易用性。

## 功能建设
此功能目前依然处于 Alpha 的早期实验版本，这里列举需要讨论或者处理的问题：

- [ ] 补全设计优化：目前的设计主要服务于功能验证，因此 UI 看起来很简陋，需要做后续的优化
- [ ] 补全交互方式优化：比如说 上下键选择，Tab 确认。或者 Tab 或者 上下键 选择，Enter 确认
- [ ] Generator 补全支持，目前还不支持调用命令的 补全，因为是基于前端做的，可能要做个前后端通信
- [ ] 渲染方式优化，目前是直接渲染在 Xterm.js Decorations 上面的，考虑做一个全局 DOM，然后通过 DOM Align + Xterm.js Decoration 来做生命周期绑定和位置绑定
- [ ] 讨论是否需要转移补全逻辑到 Node.js
- [ ] 把基于 Fig 打包 bundle 的逻辑转移到 OpenSumi 这边
- [ ] CodeStyle 处理，目前没有对从 inShellisense 项目的代码做处理，考虑到未来比较方便更新代码，不过这块要看看是不是要格式化一下代码什么的

## 开源项目依赖
感谢开源项目提供的灵感和相关能力支持：

https://github.com/withfig/autocomplete

https://github.com/microsoft/inshellisense