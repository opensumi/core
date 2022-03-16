declare module 'drivelist' {
  interface Drivelist {
    list(cb: (error: Error, drives: ({ readonly mountpoints: { readonly path: string }[] })[]) => void): void;
  }

  const drivelist: Drivelist;

  export = drivelist;
}
