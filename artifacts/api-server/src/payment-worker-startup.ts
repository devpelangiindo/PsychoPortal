type WorkerEnvironment = { PAYMENT_RECONCILIATION_WORKER_ENABLED?: string };

// Opt in explicitly: every value except the exact string "true" keeps it off.
export function startPaymentReconciliationWorker(
  env: WorkerEnvironment,
  startWorker: () => (() => void),
  registerCleanup: (stopWorker: () => void) => void,
): boolean {
  if (env.PAYMENT_RECONCILIATION_WORKER_ENABLED !== "true") return false;
  const stopWorker = startWorker();
  registerCleanup(stopWorker);
  return true;
}
