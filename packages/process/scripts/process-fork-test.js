if (process.argv[2] === 'version') {
    console.log('1.0.0');
} else {
    process.stderr.write('Error: Argument expected')
    process.exit(1)
}
