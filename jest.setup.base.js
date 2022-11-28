process.on('unhandledRejection', (error) => {
  // eslint-disable-next-line no-console
  console.error('unhandledRejection', error);
  if (process.env.EXIT_ON_UNHANDLED_REJECTION) {
    process.exit(1); // To exit with a 'failure' code
  }
});

// Do not log message on GitHub Actions.
// Because these logs will affect the detection of real problems.
const _console = global.console;
global.console = process.env.CI
  ? {
      info: () => {},
      console: () => {},
      warn: () => {},
      error: () => {},
      log: () => {},
      time: () => {},
      timeEnd: () => {},
    }
  : _console;

process.env.IS_JEST_TEST = true;
