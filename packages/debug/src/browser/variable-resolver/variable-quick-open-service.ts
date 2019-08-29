import { Autowired, Injectable } from '@ali/common-di';
import { QuickOpenService, QuickOpenModel, QuickOpenItem, QuickOpenMode } from '@ali/ide-quick-open';
import { VariableRegistry } from './variable';

@Injectable()
export class VariableQuickOpenService implements QuickOpenModel {

    protected items: QuickOpenItem[];

    @Autowired(VariableRegistry)
    protected readonly variableRegistry: VariableRegistry;

    @Autowired(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    open(): void {
        this.items = this.variableRegistry.getVariables().map(
            (v) => new VariableQuickOpenItem(v.name, v.description),
        );

        this.quickOpenService.open(this, {
            placeholder: 'Registered variables',
            fuzzyMatchLabel: true,
            fuzzyMatchDescription: true,
            fuzzySort: true,
        });
    }

    onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
        acceptor(this.items);
    }
}

export class VariableQuickOpenItem extends QuickOpenItem {

    constructor(
        protected readonly name: string,
        protected readonly description?: string,
    ) {
        super();
    }

    getLabel(): string {
        return '${' + this.name + '}';
    }

    getDetail(): string {
        return this.description || '';
    }

    run(mode: QuickOpenMode): boolean {
        return false;
    }
}
