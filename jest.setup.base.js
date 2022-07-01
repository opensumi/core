process.on('unhandledRejection', (error) => {
  // eslint-disable-next-line no-console
  console.error('unhandledRejection', error);
  if (process.env.EXIT_ON_UNHANDLED_REJECTION) {
    process.exit(1); // To exit with a 'failure' code
  }
});

process.env.IS_JEST_TEST = true;
