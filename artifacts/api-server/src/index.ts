import app from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";
import { pool } from './db';
import { startInstagramWorker } from './instagram';

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = await registerRoutes(app);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  const stopInstagram = startInstagramWorker(pool);
  httpServer.once('close', stopInstagram);
});

httpServer.on("error", (err: Error) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
