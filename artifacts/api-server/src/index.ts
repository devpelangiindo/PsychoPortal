import app from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";
import { pool } from './db';
import { startInstagramWorker } from './instagram';
import { startPaymentReconciliationWorker } from './payment-worker-startup';

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
  const paymentsEnabled = startPaymentReconciliationWorker(
    { PAYMENT_RECONCILIATION_WORKER_ENABLED: process.env.PAYMENT_RECONCILIATION_WORKER_ENABLED },
    () => app.locals.startPaymentWorker(),
    (stopPayments) => { httpServer.once('close', stopPayments); },
  );
  logger.info({ enabled: paymentsEnabled }, "Payment reconciliation worker startup");
});

httpServer.on("error", (err: Error) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
