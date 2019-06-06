export function loadVsRequire(context: any): Promise<any> {
    const originalRequire = context.require;

    return new Promise<any>((resolve, reject) => {
        const onDomReady = () => {
            const vsLoader = document.createElement('script');
            vsLoader.type = 'text/javascript';
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
    return new Promise<void>((resolve) => {
        vsRequire(['vs/editor/editor.main'], () => {
            resolve();
        });
    });
}
