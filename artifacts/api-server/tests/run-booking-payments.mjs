import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
for(const args of [
  ['tests/run-payment-worker-startup.mjs'],
  ['tests/run-booking-storage.mjs'],
  ['tests/run-midtrans-lifecycle.mjs'],
  ['tests/run-payment-lifecycle.mjs'],
  ['--test','tests/booking-reconciliation.test.mjs'],
]) {
  const result=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});
  if(result.status!==0){process.exitCode=result.status??1;break;}
}
