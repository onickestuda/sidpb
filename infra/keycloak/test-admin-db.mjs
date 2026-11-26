// Runs auth/admin tests against an isolated, disposable PostGIS database.
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const password=randomBytes(24).toString('hex');
const id=execFileSync('docker',['run','--rm','-d','--name','sidpb-admin-test-'+randomBytes(4).toString('hex'),'-p','127.0.0.1:55433:5432','-e','POSTGRES_DB=parasitologia_test','-e','POSTGRES_PASSWORD='+password,'postgis/postgis:15-3.4-alpine'],{encoding:'utf8'}).trim();
try {
  let ready=false;
  for(let i=0;i<30;i++) {if(spawnSync('docker',['exec',id,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'ignore'}).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}
  if(!ready)throw Error('Isolated test database did not become ready');
  const tests='AuthControllerTest,AuthServiceTest,IdentityIntegrationTest,AdminUsersIntegrationTest,AccountLifecycleIntegrationTest,KeycloakGatewayTest';
  const command=process.platform==='win32' ? 'cmd.exe' : './mvnw';
  const args=process.platform==='win32' ? ['/d','/c',`mvnw.cmd -Dtest=${tests} test`] : [`-Dtest=${tests}`,'test'];
  const result=spawnSync(command,args,{cwd:new URL('../../backend/',import.meta.url),env:{...process.env,TEST_DB_URL:'jdbc:postgresql://127.0.0.1:55433/parasitologia_test',TEST_DB_USERNAME:'postgres',TEST_DB_PASSWORD:password},encoding:'utf8',maxBuffer:20*1024*1024});
  writeFileSync(new URL('../../backend/target/admin-test-run.log',import.meta.url),result.stdout+result.stderr);
  console.log(result.stdout.split('\n').filter(line=>/Tests run:|BUILD |ERROR/.test(line)).join('\n'));
  process.exitCode=result.status ?? 1;
} finally {execFileSync('docker',['stop',id],{stdio:'ignore'});}
