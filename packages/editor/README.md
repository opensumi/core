# Editor

## Editor状态展示

### 光标

监听当前Group的变化，变化时获取新焦点的cursor；监听当前Group的monaco光标变化。 

-> 监听所有Group的monaco光标变化，接收到事件时判断是否是当前激活Group。

-> 新文件打开时（无restoreViewState）不会触发monaco事件，关闭时若无新EditorComponent打开也不触发
