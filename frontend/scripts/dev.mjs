import { spawn } from 'node:child_process';
import { publicUrls } from '../../infra/local-env.mjs';
const { origin } = publicUrls();
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', new URL(origin).port || '80'], { stdio: 'inherit', windowsHide: true });
child.on('exit', code => { process.exitCode = code ?? 1; });
