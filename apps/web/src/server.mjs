import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);

createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("Park Skazka Hypothesis Portal foundation\n");
}).listen(port, "127.0.0.1", () => {
  console.log(`web foundation listening on http://127.0.0.1:${port}`);
});

