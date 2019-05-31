export type QuickPickItem<T> = QuickPickValue<T> | QuickPickSeparator;

export interface QuickPickSeparator {
    type: 'separator'
    label: string
}
export namespace QuickPickSeparator {
    export function is(item: string | QuickPickItem<Object>): item is QuickPickSeparator {
        return typeof item === 'object' && 'type' in item && item['type'] === 'separator';
    }
}

export interface QuickPickValue<T> {
    label: string
    value: T
    description?: string
    detail?: string
    iconClass?: string
}

export interface QuickPickOptions {
    placeholder?: string
    /**
     * default: true
     */
    fuzzyMatchLabel?: boolean
    /**
     * default: true
     */
    fuzzyMatchDescription?: boolean
}

// export const quickPickServicePath = '/services/quickPick';
export const QuickPickService = Symbol('QuickPickService');
export interface QuickPickService {

    show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;

    show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;

}
