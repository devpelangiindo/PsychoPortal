import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { startPaymentReconciliationWorker } from "../src/payment-worker-startup";

test("payment worker defaults off and only the exact true value opts in", () => {
  for (const value of [undefined, "false", "", "TRUE", " true ", "1", "yes"]) {
    let started = 0;
    let registered = 0;
    const enabled = startPaymentReconciliationWorker(
      value === undefined ? {} : { PAYMENT_RECONCILIATION_WORKER_ENABLED: value },
      () => { started += 1; return () => {}; },
      () => { registered += 1; },
    );
    assert.equal(enabled, false, String(value));
    assert.equal(started, 0, String(value));
    assert.equal(registered, 0, String(value));
  }
});

test("enabled payment worker starts once and registers its cleanup on server close", () => {
  const server = new EventEmitter();
  let started = 0;
  let stopped = 0;
  const enabled = startPaymentReconciliationWorker(
    { PAYMENT_RECONCILIATION_WORKER_ENABLED: "true" },
    () => { started += 1; return () => { stopped += 1; }; },
    (stopWorker) => { server.once("close", stopWorker); },
  );
  assert.equal(enabled, true);
  assert.equal(started, 1);
  assert.equal(stopped, 0);
  assert.equal(server.listenerCount("close"), 1);
  server.emit("close");
  server.emit("close");
  assert.equal(stopped, 1);
});
