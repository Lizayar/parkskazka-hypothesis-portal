import { createServer } from "node:http";

const port = Number(process.env.API_PORT || 3001);

createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ service: "api", status: "foundation" }));
}).listen(port, "127.0.0.1", () => {
  console.log(`api foundation listening on http://127.0.0.1:${port}`);
});

