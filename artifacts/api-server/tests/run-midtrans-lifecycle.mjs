import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../tmp/midtrans-lifecycle.test.mjs',import.meta.url));
await build({entryPoints:[fileURLToPath(new URL('./midtrans-lifecycle.test.ts',import.meta.url))],outfile:output,
  bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{
    name:'recording-midtrans-sdk',setup(build){
      build.onResolve({filter:/^midtrans-client$/},()=>({path:'recording-sdk',namespace:'test'}));
      build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`
        export const requests=[];
        class Snap{async createTransaction(value){requests.push(value);return {token:'test-token',redirect_url:'https://example.invalid/test'};}}
        class CoreApi{constructor(){this.transaction={status:async()=>({}),expire:async()=>({}),notification:async()=>({})};}}
        export default {Snap,CoreApi};`,loader:'js'}));
    }
  }]});
const result=spawnSync(process.execPath,['--test',output],{stdio:'inherit'});
process.exitCode=result.status??1;
