# Rethinking Back Service

在 OpenSumi 中，`back service` 是用来处理某一个前端连接打开后的交互，在前端连接释放后，`back service` 也会被释放。

在我们过去的实践中，我们会遇到以下几个场景的问题：

1. back service 中的数据无法持久化，导致重连后数据消失
2. back service 将自己的数据储存在外部，导致内存泄露
3. back service 机制比较隐晦，比如会自动多例，自动创建 child injector
4. 由于 3 的原因，back service 会被创建为多例，导致某些模块错误使用 `@Autowired` 引用 back service 后, 每次拿到一个空状态的 back service

将自己的数据储存在外部也会有很多问题：

1. 数据的保存需要大量的 Map 来存储状态
2. 多个 back service 不小心对同样的一个外部状态进行了清空
3. 每个 back service 要写一份自己的存储逻辑

分析问题，得到解决方案：

1. back service 不可被 `@Autowired` 引用到
2. 内置 back service 配套的储存层 back service data store
