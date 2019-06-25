export function loadVsRequire(context: any): Promise<any> {
    const originalRequire = context.require;

    return new Promise<any>((resolve, reject) => {
        const onDomReady = () => {
            const vsLoader = document.createElement('script');
            vsLoader.type = 'text/javascript';
            // NOTE 直接使用社区的版本会加载worker？会和ts有两重提示，需要设计优先级
            vsLoader.src = 'https://g.alicdn.com/tb-theia-app/theia-assets/0.0.10/vs/loader.js';
            vsLoader.charset = 'utf-8';
            vsLoader.addEventListener('load', () => {
                // Save Monaco's amd require and restore the original require
                const amdRequire = context.require;
                amdRequire.config({ paths: { vs: 'https://g.alicdn.com/tb-theia-app/theia-assets/0.0.10/vs' } });

                if (originalRequire) {
                    context.require = originalRequire;
                }
                resolve(amdRequire);
            });
            vsLoader.addEventListener('error', (e) => {
                // tslint:disable-next-line
                console.error(e);
                reject(e);
            });
            document.body.appendChild(vsLoader);
        };

        if (document.readyState === 'complete') {
            onDomReady();
        } else {
            window.addEventListener('load', onDomReady, { once: true });
        }
    });
}

export function loadMonaco(vsRequire: any): Promise<void> {
    const global = window as any;
    // https://github.com/Microsoft/monaco-editor/blob/master/docs/integrate-amd-cross.md
    global.MonacoEnvironment = {
        getWorkerUrl() {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = {
              baseUrl: 'https://g.alicdn.com/tb-theia-app/theia-assets/0.0.8/'
            };
            importScripts('https://g.alicdn.com/tb-theia-app/theia-assets/0.0.8/vs/base/worker/workerMain.js');`,
            )}`;
        },
    };
    // NOTE 直接加载 editor.main 时不会 load 其他service
    return new Promise<void>((resolve) => {
        vsRequire(['vs/editor/editor.main'], () => {
            vsRequire([
                'vs/editor/standalone/browser/standaloneServices',
                'vs/editor/browser/services/codeEditorService',
                'vs/editor/browser/services/codeEditorServiceImpl',
                'vs/platform/contextview/browser/contextViewService',
                'vs/base/parts/quickopen/common/quickOpen',
                'vs/base/parts/quickopen/browser/quickOpenWidget',
                'vs/base/parts/quickopen/browser/quickOpenModel',
                'vs/base/common/filters',
            ], (standaloneServices: any, codeEditorService: any, codeEditorServiceImpl: any, contextViewService: any,
                quickOpen: any, quickOpenWidget: any, quickOpenModel: any, filters: any ) => {

                global.monaco.services = Object.assign({}, standaloneServices, codeEditorService, codeEditorServiceImpl, contextViewService);
                global.monaco.quickOpen = Object.assign({}, quickOpen, quickOpenWidget, quickOpenModel);
                global.monaco.filters = filters;
                resolve();
            });
        });
    });
}
