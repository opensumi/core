import perfectScrollbar = require('react-perfect-scrollbar');
import './scrollbar.less';

/**
 * 绕开Tslint类型检查的不得已操作
 * 原因：react-perfect-scrollbar 模块引入存在问题
 */
export const PerfectScrollbar: any  = perfectScrollbar;
