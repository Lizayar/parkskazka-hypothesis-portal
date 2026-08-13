console.log("worker foundation ready; durable queue is introduced in a later task");

const interval = setInterval(() => {
  // Keep the Render worker alive until the queue consumer is wired.
}, 60_000);

function shutdown() {
  clearInterval(interval);
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

