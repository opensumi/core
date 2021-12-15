import * as runtime from 'serviceworker-webpack-plugin/lib/runtime';

export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      runtime
        .register()
        .then((registration) => {
          // tslint:disable-next-line:no-console
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          // tslint:disable-next-line:no-console
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        // tslint:disable-next-line:no-console
        console.error(error.message);
      });
  }
}
