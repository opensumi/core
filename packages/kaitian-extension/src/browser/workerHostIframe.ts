import { v4 } from 'uuid';

export const WORKER_HOST_HARD_CODE = `
(function() {
  const workerSrc = document.getElementById('kaitian-worker-src').getAttribute('data-value');
	const worker = new Worker(workerSrc, { name: 'KaitianWorkerExtensionHost' });
	const kaitianWebWorkerExtHostId = document.getElementById('kaitian-web-worker-ext-host-id').getAttribute('data-value');

	worker.onmessage = (event) => {
    const { data } = event;
    if (data instanceof MessagePort) {
      window.parent.postMessage({
        kaitianWebWorkerExtHostId,
        data: data
      }, '*', [data]);
      return;
    }

    window.parent.postMessage({
      kaitianWebWorkerExtHostId,
      data: data
    }, '*');
	};

	worker.onerror = (event) => {
		console.error(event.message, event.error);
		window.parent.postMessage({
			kaitianWebWorkerExtHostId,
			error: {
				name: event.error ? event.error.name : '',
				message: event.error ? event.error.message : '',
				stack: event.error ? event.error.stack : []
			}
		}, '*');
	};

	window.addEventListener('message', function(event) {
		if (event.source !== window.parent) {
			return;
		}
		if (event.data.kaitianWebWorkerExtHostId !== kaitianWebWorkerExtHostId) {
			return;
    }

		worker.postMessage(event.data.data);
	}, false);
})();
`;

export function startInsideIframe(workerSrc: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('class', 'web-worker-ext-host-iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.style.display = 'none';
  const escapeAttribute = (value: string): string => {
    return value.replace(/"/g, '&quot;');
  };
  const extHostUuid = v4();
  const html = `<!DOCTYPE html>
<html>
	<head>
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' http:; worker-src data:; connect-src http:" />
		<meta id="kaitian-worker-src" data-value="${escapeAttribute(workerSrc)}" />
		<meta id="kaitian-web-worker-ext-host-id" data-value="${escapeAttribute(extHostUuid)}" />
	</head>
	<body>
	<script>${WORKER_HOST_HARD_CODE}</script>
	</body>
</html>`;

  const iframeContent = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  iframe.setAttribute('src', iframeContent);

  document.body.appendChild(iframe);
  return { iframe, extHostUuid };
}
