import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("Park Skazka Hypothesis Portal foundation\n");
}).listen(port, host, () => {
  console.log(`web foundation listening on http://${host}:${port}`);
});

