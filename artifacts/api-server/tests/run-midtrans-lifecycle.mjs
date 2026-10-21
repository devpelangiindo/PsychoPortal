import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../tmp/midtrans-lifecycle.test.mjs',import.meta.url));
await build({entryPoints:[fileURLToPath(new URL('./midtrans-lifecycle.test.ts',import.meta.url))],outfile:output,
  bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{
    name:'recording-midtrans-sdk',setup(build){
      build.onResolve({filter:/^midtrans-client$/},()=>({path:'recording-sdk',namespace:'test'}));
      build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`
        import {createRequire} from 'node:module';
        const realSdk=createRequire(import.meta.url)('midtrans-client');
        export const requests=[];
        export const gateways={};
        class Snap extends realSdk.Snap{
          constructor(options){super(options);gateways.snap=this;this.useRealTransport=false;}
          async createTransaction(value){requests.push(value);return this.useRealTransport?super.createTransaction(value):{token:'test-token',redirect_url:'https://example.invalid/test'};}
        }
        class CoreApi extends realSdk.CoreApi{constructor(options){super(options);gateways.core=this;}}
        export default {Snap,CoreApi};`,loader:'js'}));
    }
  }]});
const result=spawnSync(process.execPath,['--test',output],{stdio:'inherit'});
process.exitCode=result.status??1;
