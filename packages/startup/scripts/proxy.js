var express = require('express');
var app = express();
var httpProxy = require('http-proxy');
var proxy = httpProxy.createProxyServer({ target: 'http://localhost:8000', ws: true });

var server = require('http').createServer(app);

// proxy HTTP GET / POST
app.get('/*', function (req, res) {
  console.log("proxying GET request", req.url);
  proxy.web(req, res, {});
});
app.post('/*/*', function (req, res) {
  console.log("proxying POST request", req.url);
  proxy.web(req, res, {});
});

// Proxy websockets
server.on('upgrade', function (req, socket, head) {
  console.log("proxying upgrade request", req.url);
  proxy.ws(req, socket, head);
});

server.listen(8001);