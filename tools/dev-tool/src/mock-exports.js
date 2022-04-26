// 会使用到的测试文件
// - packages/debug/__tests__/browser/debug-ansi-handle.test.ts
//   使用了 styles['code-bold'] 等

const idObj = new Proxy(
  {
    mod_selected: 'mod_selected',
    mod_focused: 'mod_focused',
    mod_loading: 'mod_loading',
    mod_cut: 'mod_cut',
    mod_dragging: 'mod_dragging',
    mod_dragover: 'mod_dragover',
    mod_dirty: 'mod_dirty',
    mod_actived: 'mod_actived',
  },
  {
    get: function getter(target, key) {
      if (key === '__esModule') {
        return false;
      }
      return target[key] || key;
    },
  },
);

module.exports = idObj;
