const path = require('path');

const express = require('express');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const proxyMap = require('./proxy-map');

Object.keys(proxyMap).forEach((path) => {
  app.use(path, createProxyMiddleware(proxyMap[path]));
});

app.use(compression());

app.use(express.static(path.join(__dirname, 'dist')));

const port = 8090;

app.listen(port, () => {
  console.log(`Your application is running here: http://localhost:${port}`);
});
