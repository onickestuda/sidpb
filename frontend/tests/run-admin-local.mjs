// Isolated local test processes, real existing Keycloak, no deployment/replacement.
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {openSync,closeSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
process.loadEnvFile(new URL('../../.env',import.meta.url));
const browser=await chromium.launch();
const children=[];let database,client,original,operator;
let token, tokenExpires=0;
const root=new URL('../../',import.meta.url);
const output=mkdtempSync(join(tmpdir(),'sidpb-admin-e2e-'));
const origin='http://localhost:3100', callback=origin+'/sidpb/api/auth/callback/', logout=origin+'/sidpb/';
async function loginOperator() {
  if(operator)await operator.close();operator=await browser.newPage();
  const response=operator.waitForResponse(r=>r.url().includes('/realms/master/protocol/openid-connect/token')&&r.request().method()==='POST'&&r.status()===200);
  await operator.goto('http://localhost:8081/admin/master/console/');
  await operator.locator('#username').fill(process.env.KEYCLOAK_ADMIN);
  await operator.locator('#password').fill(process.env.KEYCLOAK_ADMIN_PASSWORD);
  await operator.locator('#kc-login').click();
  const result=await(await response).json();token=result.access_token;tokenExpires=Date.now()+(result.expires_in-10)*1000;
}
async function admin(method,path,body) {
  if(Date.now()>=tokenExpires)await loginOperator();
  const response=await fetch('http://localhost:8081/admin/realms/sidpb'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw Error(`Admin test setup ${method} ${path}: ${response.status}`);
  const value=await response.text();return value?JSON.parse(value):null;
}
function launch(command,args,cwd,env,name) {
  const fd=openSync(join(output,name+'.log'),'w');
  const child=spawn(command,args,{cwd,env,windowsHide:true,stdio:['ignore',fd,fd]});closeSync(fd);children.push(child);return child;
}
async function ready(url) {
  for(let i=0;i<90;i++){if(children.some(child=>child.exitCode!==null))throw Error('Test process exited; logs '+output);try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}
  throw Error('Test service did not become ready: '+url+'; logs '+output);
}
try {
  await loginOperator();[client]=await admin('GET','/clients?clientId=sidpb-web');original=await admin('GET','/clients/'+client.id);
  await admin('PUT','/clients/'+client.id,{redirectUris:[...new Set([...original.redirectUris,callback])],attributes:{...original.attributes,'post.logout.redirect.uris':[...new Set([...(original.attributes['post.logout.redirect.uris']||'').split('##'),logout])].filter(Boolean).join('##')}});
  const password=randomBytes(24).toString('hex');
  database=execFileSync('docker',['run','--rm','-d','--name','sidpb-admin-e2e-'+randomBytes(4).toString('hex'),'-p','127.0.0.1:55434:5432','-e','POSTGRES_DB=sidpb_admin_e2e','-e','POSTGRES_PASSWORD='+password,'postgis/postgis:15-3.4-alpine'],{encoding:'utf8'}).trim();
  let databaseReady=false;
  for(let i=0;i<45;i++) {
    if(spawnSync('docker',['exec',database,'pg_isready','-h','127.0.0.1','-U','postgres','-d','sidpb_admin_e2e'],{stdio:'ignore'}).status===0){databaseReady=true;break;}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!databaseReady)throw Error('Isolated database did not become ready');
  const env={...process.env,POSTGRES_HOST:'127.0.0.1',POSTGRES_PORT:'55434',POSTGRES_DB:'sidpb_admin_e2e',POSTGRES_USER:'postgres',POSTGRES_PASSWORD:password,KEYCLOAK_INTERNAL_URL:'http://localhost:8081',SIDPB_SUBMISSIONS_STORAGE_DIR:join(output,'submissions')};
  launch(process.env.JAVA_HOME ? join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java') : 'java',['-jar','target/sidpb-app-0.0.1-SNAPSHOT.jar','--server.port=8082'],new URL('backend/',root),env,'api');
  await ready('http://localhost:8082/api/mapa/ocorrencias');
  launch(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100'],new URL('frontend/',root),{...env,AUTH_ORIGIN:origin,AUTH_ALLOW_HTTP:'true',INTERNAL_API_URL:'http://localhost:8082',NEXT_PUBLIC_BASE_PATH:'/sidpb',AUTH_SESSION_DIR:join(output,'sessions')},'frontend');
  await ready(origin+'/sidpb/');
  const test=spawn(process.execPath,['tests/keycloak-auth.e2e.mjs'],{cwd:new URL('frontend/',root),env:{...process.env,AUTH_TEST_ORIGIN:origin,AUTH_TEST_API:'http://localhost:8082',AUTH_TEST_ADMIN:'true'},windowsHide:true,stdio:'inherit'});
  process.exitCode=await new Promise(resolve=>test.on('exit',code=>resolve(code??1)));
  if(process.exitCode===0) {
    const theme=spawn(process.execPath,['tests/keycloak-theme.e2e.mjs'],{cwd:new URL('frontend/',root),env:{...process.env,AUTH_TEST_ORIGIN:origin},windowsHide:true,stdio:'inherit'});
    process.exitCode=await new Promise(resolve=>theme.on('exit',code=>resolve(code??1)));
  }
} finally {
  for(const child of children) {
    if(process.platform==='win32' && child.pid) spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    else child.kill();
  }
  if(database)execFileSync('docker',['stop',database],{stdio:'ignore'});
  if(original) {
    const current=await admin('GET','/clients/'+client.id);
    await admin('PUT','/clients/'+client.id,{redirectUris:original.redirectUris.includes(callback)?current.redirectUris:current.redirectUris.filter(uri=>uri!==callback),attributes:{...current.attributes,'post.logout.redirect.uris':(current.attributes['post.logout.redirect.uris']||'').split('##').filter(uri=>uri!==logout||(original.attributes['post.logout.redirect.uris']||'').split('##').includes(logout)).join('##')}});
  }
  await browser.close();console.log('Local test processes stopped; temporary OIDC redirects removed. Logs: '+output);
}
