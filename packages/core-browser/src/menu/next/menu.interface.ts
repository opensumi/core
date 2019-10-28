import { Uri, URI } from '@ali/ide-core-common';
import * as vscode from 'vscode';

// explorer/context
// 资源管理器 ctxmenu
// 第一个参数是当前 ctx-menu 出现在的那个 ExplorerItem 的 Uri
// 第二个参数是多选时 ExplorerItem 列表的 Uri
export type ExplorerContextParams = [URI, URI[]];

export type ExplorerContextCallback = (...args: ExplorerContextParams) => void;

// editor/context
export type EditorContextArgs = [Uri, Uri[]];
export type EditorContextCallback = (...args: [Uri]) => void;

type GroupId = number; // vscode.IEditorGroupView['id'];
// editor/title
// editor tab group 最右侧 ellipsis 图标点击 dropdown
type EditorTitleCallback = (...args: [Uri, { groupId: GroupId }]) => void;

// editor/title/context
// editor tab ctxmenu
interface EditorTitleExtraArgs {
  groupId: GroupId;
  editorIndex: number;
}
// 参考 src/vs/workbench/browser/parts/editor/titleControl.ts#304,310
type EditorTitleContextCallback = (...args: [Uri, EditorTitleExtraArgs]) => void;

// debug/callstack/context
// debug 时 callstack list item 的 ctxmenu
// arg.0:"file:///Users/vagusx/Project/ide-test-workspace/aa/aaa.js"
// arg.1:"stackframe:thread:a0f28e52-6237-40ce-a0d9-11fe2a2de819:1:1001:0"
type DebugCallstackContextCallbak = (...args: [string, string]) => void;

// debug/toolbar
// debug toolbar 上
type DebugToolbarCallbak = (...args: []) => void;

// scm/title
// scm titlebar 的 inline actions/more actions
// 此处是 hosted object
type ScmTitleCallback = (...args: [vscode.SourceControl]) => void; // 实际为拓展后的 ExtHostSourceControl

// scm/resourceGroup/context
// scm resource list 的 group 的 ctxmenu
// 此处是 hosted object
type ScmResourceGroupContextCallback = (...args: [vscode.SourceControlResourceGroup]) => void; // 实际为拓展后的 ExtHostSourceControlResourceGroup

// scm/resourceState/context // 老版本是 scm/resource/context
// scm resource list 的 item 的 ctxmenu
// 此处是 hosted object
type ScmResourceStateContextCallback = (...args: [vscode.SourceControlResourceState]) => void;

// scm/change/title
// diff editor 的最右侧 ellipsis 图标点击 dropdown
// 此处 Uri 是 git scheme 的
type ScmChangeTitleCallback = (...args: [Uri, GroupId]) => void;

// view/title
// 自定义 contributed view 的 inline actions/more actions
// 此处参数应该是各个 view 自行定义的
type ViewTitleCallback = (...args: []) => void;

// view/item/context
// 自定义 contributed view 中 list item 的 ctx menu
// 此处参数应该是各个 view 自行定义的
type ViewItemCallback = (...args: []) => void;

// 目前我们没有实现 comment 相关 API
// comment 相关可参见 https://github.com/microsoft/vscode/issues/77663
// comments/commentThread/title
// comments/commentThread/context
// comments/comment/title
// comments/comment/context
