import http from 'node:http';

const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('id: 1\nevent: delta\ndata: {"text":"first"}\n\n');
  setTimeout(() => {
    res.write('id: terminal\nevent: done\ndata: {"citations":[]}\n\n');
    res.end();
  }, 80);
});

server.listen(0, '127.0.0.1', async () => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  const reader = response.body.getReader();
  const chunks = [];
  const arrivalMs = [];
  const started = Date.now();
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(Buffer.from(result.value).toString());
    arrivalMs.push(Date.now() - started);
  }
  server.close();
  const events = chunks.map((chunk) => chunk.match(/event: (\w+)/)?.[1]);
  console.log(JSON.stringify({ chunks: chunks.length, arrivalMs, events }));
  if (chunks.length < 2 || arrivalMs[1] < 50) process.exitCode = 1;
});
