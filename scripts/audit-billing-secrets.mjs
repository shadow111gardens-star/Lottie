import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';
config({path:['.env.local','.env'],quiet:true});
const names=['DODO_PAYMENTS_API_KEY','DODO_PAYMENTS_WEBHOOK_SECRET','FIREBASE_ADMIN_SERVICE_ACCOUNT','R2_SECRET_ACCESS_KEY','R2_ACCESS_KEY_ID'];
const values=names.map(name=>process.env[name]).filter(value=>value&&value.length>8);
let account;try{account=JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT||'null');}catch{}
if(account?.private_key)values.push(account.private_key);
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const current=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const failures=[];let count=0;
for(const file of new Set(current)){
 if(!/\.(?:m?[jt]sx?|json|html|css|md|txt|ya?ml|rules|env)$/.test(file))continue;
 const text=await readFile(file,'utf8').catch(()=>null);if(text===null)continue;count++;
 if(values.some(value=>text.includes(value))||/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(text))failures.push(file);
}
const envTracked=tracked.filter(file=>/(?:^|\/)\.env(?:\.|$)/.test(file));failures.push(...envTracked);
// Scan reachable Git history for known configured secrets and private-key material, without printing patches.
const history=execFileSync('git',['log','--all','--format=','--patch','--','.'],{encoding:'utf8',maxBuffer:128*1024*1024});
const historyExposure=values.some(value=>history.includes(value))||/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(history);
const html=await readFile('dist/index.html','utf8');
const bundleExposure=values.some(value=>html.includes(value))||names.some(name=>html.includes(name))||/firebase-admin|@aws-sdk\/client-s3/.test(html);
console.log(JSON.stringify({scannedFiles:count,currentSecretExposure:failures.length>0,affectedFiles:failures,trackedEnvironmentFiles:envTracked,reachableHistorySecretExposure:historyExposure,browserSecretOrServerSdkExposure:bundleExposure}));
if(failures.length||historyExposure||bundleExposure)process.exitCode=1;
