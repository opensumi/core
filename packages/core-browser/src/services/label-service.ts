import { Autowired, Injectable } from '@ali/common-di';
import * as fileIcons from 'file-icons-js';
import { URI } from '@ali/ide-core-common';

export type MaybePromise<T> = T | Promise<T> | PromiseLike<T>;

export const FOLDER_ICON = 'fa fa-folder';
export const FILE_ICON = 'fa fa-file';

export const LabelProviderContribution = Symbol('LabelProviderContribution');
export interface LabelProviderContribution {

    /**
     * 判断该Contribution是否能处理该类型，返回权重
     */
    canHandle(element: object): number;

    /**
     * 根据URI返回Icon样式.
     */
    getIcon?(element: object): MaybePromise<string>;

    /**
     * 返回短名称.
     */
    getName?(element: object): string;

    /**
     * 返回长名称.
     */
    getLongName?(element: object): string;

}

@Injectable()
export class DefaultUriLabelProviderContribution implements LabelProviderContribution {

    canHandle(uri: object): number {
        if (uri instanceof URI) {
            return 1;
        }
        return 0;
    }

    getIcon(uri: URI): MaybePromise<string> {
        const iconClass = this.getFileIcon(uri);
        if (!iconClass) {
            if (uri.displayName.indexOf('.') === -1) {
                return FOLDER_ICON;
            } else {
                return FILE_ICON;
            }
        }
        return iconClass;
    }

    getName(uri: URI): string {
        return uri.displayName;
    }

    getLongName(uri: URI): string {
        return uri.path.toString();
    }

    protected getFileIcon(uri: URI): string | undefined {
      return fileIcons.getClassWithColor(uri.displayName);
    }
}

@Injectable()
export class LabelService {
    @Autowired()
    public LabelProviderContribution: DefaultUriLabelProviderContribution;

    async getIcon(uri: URI): Promise<string> {
        return this.LabelProviderContribution!.getIcon(uri);
    }

    getName(uri: URI): string {
        return this.LabelProviderContribution!.getName(uri);
    }

    getLongName(uri: URI): string {
        return this.LabelProviderContribution!.getLongName(uri);
    }

}
