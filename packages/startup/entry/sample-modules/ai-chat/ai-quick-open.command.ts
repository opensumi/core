import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { QuickOpenItem } from '@opensumi/ide-core-browser';
import { MaybePromise, QuickOpenHandler, QuickOpenModel, QuickOpenOptions, QuickOpenTabOptions } from "@opensumi/ide-core-browser";

@Injectable()
export class AiQuickCommandHandler implements QuickOpenHandler {
    private items: QuickOpenItem[];
    default?: boolean | undefined = true;
    prefix: string = '/ ';
    description: string = 'AI 助手';
    init?(): MaybePromise<void> {
        console.log('init');
    }
    getModel(): QuickOpenModel {
        return {
            onType: (lookFor: string, acceptor: (items: QuickOpenItem[]) => void) => {
                acceptor(this.items);
            },
        };
    }
    getOptions(): Omit<Partial<QuickOpenOptions.Resolved>, keyof QuickOpenTabOptions> {
        return {

        }
    }
    onClose?: ((canceled: boolean) => void) | undefined;
    onToggle?: (() => void) | undefined;
}
