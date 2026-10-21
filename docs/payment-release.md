# Controlled release of booking payment synchronization

## Activation

The periodic payment reconciliation worker starts only when the API service environment contains the exact value:

```text
PAYMENT_RECONCILIATION_WORKER_ENABLED=true
```

Missing, empty, `false`, and other values keep the worker disabled. The API startup log records `Payment reconciliation worker startup` with `enabled: true` or `false`. The worker is stopped when the HTTP server closes.

This switch controls the periodic background worker only. It does not disable authenticated payment synchronization requests, Midtrans webhooks, payment creation, or additive schema initialization during API startup. It is not a sandbox mode. Midtrans remains configured for production, so test data or a production database clone must not be combined with production payment credentials for test transactions.

## Production release sequence

1. Confirm the actual Render service branch, build/start commands, database connection target, and currently deployed commit. Do not print credentials or paste connection strings into issues or logs.
2. Confirm a usable database recovery point or create a logical export before deployment. Record the previous application commit and a recovery plan that preserves subsequent legitimate payments.
3. Check the existing schema for compatibility with the additive changes. The migration adds nullable order fields and payment history/audit tables and indexes; it does not import test fixtures or merge any named orders.
4. Deploy API and frontend from the reviewed commit with the periodic worker initially disabled. Verify health, startup/migration success, the deployed commit, authenticated order/booking reads, staff visibility, and client receipt metadata. No dummy booking or payment is to be inserted into production for testing.
5. Enable `PAYMENT_RECONCILIATION_WORKER_ENABLED=true` on the API service after the preceding checks, then verify the resulting deployment and startup log. Review real synchronization results and errors. Provider uncertainty must retain a verification hold rather than mark a payment cancelled.

Orders 116 and 117 are not automatically paired by this release. Any manual reconciliation requires inspection of real records and provider evidence through the separate reviewed workflow. Do not restore the whole database over new transactions or roll back to code that ignores payment source/replacement links without evaluating the data implications.

## Pull request previews

Use `[skip preview]` in the pull request title until the preview database and payment settings are verified. Render service previews can inherit the base service's database and other environment variables. The skip marker prevents a review preview from starting against unintended production connections; it does not skip the production deployment of a merge commit.

## Validation

```text
node artifacts/api-server/tests/run-booking-payments.mjs
node artifacts/asesmen-platform/tests/run-booking-payment-state.mjs
node artifacts/api-server/build.mjs
```

The combined API runner includes the opt-in worker startup tests. Existing local tests use isolated PGlite databases and fake providers. Production build/start commands do not run these fixtures.

Release preparation validation: 63 automated tests passed (57 API tests including 2 worker activation cases, plus 6 frontend payment-state tests). The API production bundle was rebuilt successfully after adding the activation guard. The frontend is unchanged from its previously validated production build. No new type diagnostics were introduced; the existing API/frontend diagnostic counts remain 98/52. Production authentication, database recovery point, and service configuration must still be verified in the actual Render workspace before triggering deployment.

A GitHub merge can be separated from production deployment by including `[skip render]` in the final merge commit message. Do not equate that merge with a completed deployment. The reviewed commit must subsequently be deployed manually after the production checks above.

References: [Render deployment controls](https://render.com/docs/deploys), [Render Postgres recovery and backups](https://render.com/docs/postgresql-backups), [Render service previews](https://render.com/docs/service-previews).
