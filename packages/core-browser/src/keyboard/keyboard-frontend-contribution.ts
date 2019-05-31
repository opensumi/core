import { Autowired, Injectable } from '@ali/common-di';
import { isOSX, QuickPickService, QuickPickItem, Domain } from '@ali/ide-core-common';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common/lib/command';
import { BrowserKeyboardLayoutProvider, KeyboardLayoutData } from './keyboard-layout-provider';

// tslint:disable-next-line:no-namespace
export namespace KeyboardCommands {

    const KEYBOARD_CATEGORY = 'Keyboard';

    export const CHOOSE_KEYBOARD_LAYOUT: Command = {
        id: 'core.keyboard.choose',
        category: KEYBOARD_CATEGORY,
        label: 'Choose Keyboard Layout',
    };

}

@Injectable()
@Domain(CommandContribution)
export class BrowserKeyboardFrontendContribution implements CommandContribution {

    @Autowired(BrowserKeyboardLayoutProvider)
    protected readonly layoutProvider: BrowserKeyboardLayoutProvider;

    @Autowired(QuickPickService)
    protected readonly quickPickService: QuickPickService;

    registerCommands(commandRegistry: CommandRegistry): void {
        commandRegistry.registerCommand(KeyboardCommands.CHOOSE_KEYBOARD_LAYOUT, {
            execute: () => this.chooseLayout(),
        });
    }

    protected async chooseLayout() {
        const current = this.layoutProvider.currentLayoutData;
        const autodetect: QuickPickItem<'autodetect'> = {
            label: 'Auto-detect',
            description: this.layoutProvider.currentLayoutSource !== 'user-choice' ? `(current: ${current.name})` : undefined,
            detail: 'Try to detect the keyboard layout from browser information and pressed keys.',
            value: 'autodetect',
        };
        const pcLayouts = this.layoutProvider.allLayoutData
            // tslint:disable-next-line: arrow-parens
            .filter(layout => layout.hardware === 'pc')
            .sort((a, b) => compare(a.name, b.name))
            .map((layout) => this.toQuickPickValue(layout, current === layout));
        const macLayouts = this.layoutProvider.allLayoutData
            .filter((layout) => layout.hardware === 'mac')
            .sort((a, b) => compare(a.name, b.name))
            .map((layout) => this.toQuickPickValue(layout, current === layout));
        let layouts: QuickPickItem<KeyboardLayoutData | 'autodetect'>[];
        if (isOSX) {
            layouts = [
                autodetect,
                { type: 'separator', label: 'Mac Keyboards' }, ...macLayouts,
                { type: 'separator', label: 'PC Keyboards' }, ...pcLayouts,
            ];
        } else {
            layouts = [
                autodetect,
                { type: 'separator', label: 'PC Keyboards' }, ...pcLayouts,
                { type: 'separator', label: 'Mac Keyboards' }, ...macLayouts,
            ];
        }
        const chosen = await this.quickPickService.show(layouts, { placeholder: 'Choose a keyboard layout' });
        if (chosen) {
            return this.layoutProvider.setLayoutData(chosen);
        }
    }

    protected toQuickPickValue(layout: KeyboardLayoutData, isCurrent: boolean): QuickPickItem<KeyboardLayoutData> {
        return {
            label: layout.name,
            description: `${layout.hardware === 'mac' ? 'Mac' : 'PC'} (${layout.language})${isCurrent ? ' - current layout' : ''}`,
            value: layout,
        };
    }

}

function compare(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}
