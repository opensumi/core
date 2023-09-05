import { CodeFuseConfigModel } from './competionModel';
export const apiBaseUrl = "http://localhost:3002";
const URL = 'https://caselike.alipay.com'
// 1.1基于GPT模型的代码补全(原COMMAND_GPT_CODEGEN)
export const codeFuseCommandGptCodegenUrl = URL + '/v1/function/commandGptCodegen';
// 1.2插件非流式功能(包含生成注释,生成代码等. 原:COMMAND_CHATCOMMAND)
export const codeFuseChatcommandUrl = URL + "/v1/function/chatcommand";
// 1.3对话(原 /v1/api/invokeWithStream接口)
export const codeFuseChatUrl = URL + '/v1/function/talkOnStream';
// 1.4评论对话消息(原MESSAGE_COMMENT)
export const codeFuseMessageCommentUrl = URL + '/v1/function/messageComment';

// 2.1查询用户信息(原:QUERY_USER)
export const codeFuseServiceUrl = URL + "/v1/user/queryUser";
// 2.2查询公钥(原:COMMAND_QUERYPUBKEY)
export const codeFuseQueryPubkeyUrl = URL + '/v1/common/queryPubkey';
// 2.3查询插件配置(原:COMMAND_QUERY_CONFIGDATA)
export const codeFuseQueryPluginConfigUrl = URL + '/v1/common/queryPluginConfig';
// 2.4申请权限(原:APPLY_PERMISSION)
export const codeFuseApplyPermissionUrl = URL + '/v1/common/applyPermission';
// 2.5提交插件埋点(原:/v1/api/submitReportEventTrack)
export const codeFuseTrackUrl = URL + 'v1/common/submitReportEventTrack';


export const DEFAULT_API = 'https://marketplace.antfin-inc.com';
export const EXTENSION_ID = 'codeFuse.CodeFuse';

export const ACCOUNT_ID = 'bwdMKeo-xuSUNiHHaGtPl0mH ';
export const MASTER_KEY = 'IiBub2NWe0m7Va27heW0dY_f';

/**
 * 接受补全事件
 */
export const COMMAND_ACCEPT = "CF_COMMAND_ACCEPT";

/**
 * 插件配置信息
 */
export let codeFuseDefaultConfig: CodeFuseConfigModel = {
	"chatPromptMaxSize": 4096,
	"completionFileList": ["java", "go", "python", "javascript", "typescript"],
	"completionPromptMaxLineSize": 1024,
	"completionSuffixMaxLineSize": 500,
	"intervalTime": 1800000,
	"streamTimeOut": 40000,
	"timeOut": 20000,
	"completionRegular": "[\\)\\]\\}]"
};


/**
 * 更新配置
 * @param newTsingyanConfig 
 */
export function resetConfig(newTsingyanConfig: CodeFuseConfigModel) {
	codeFuseDefaultConfig = newTsingyanConfig;
}

export function isEmpty(value: any) {
	if (value === null || value === undefined) {
		return true;
	}
	if (typeof value === 'string' && value.trim() === '') {
		return true;
	}
	if (Array.isArray(value) && value.length === 0) {
		return true;
	}
	if (typeof value === 'object' && Object.keys(value).length === 0) {
		return true;
	}
	return false;
}

export interface IRawExtension extends IExtension {
	isInstalled: boolean;
	needUpdate: boolean;
}

/**
* 插件市场插件数据
*/
export interface IExtension {
	extensionId: string;
	name: string;
	publisher: string;
	displayName: string;
	description: string;
	icon: string;
	version: string;
	downloadCount: number;
	originId: string;
}

export interface IExtensionManager {
	install(extensionId: string, version: string): Promise<void>;
	update(extensionId: string, version: string): Promise<void>;
}