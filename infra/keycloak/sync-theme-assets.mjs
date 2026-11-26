// No network access. Copies canonical assets, or fails if generated copies drift.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = new URL('../../frontend/public/', import.meta.url);
const target = new URL('./themes/sidpb/login/resources/', import.meta.url);
const hashes = {};
for (const [input,output] of [['auth/login-map.png','auth/login-map.png'],['auth/prelogin.css','auth/prelogin.css'],['logo.svg','img/logo.svg']]) {
  const bytes = readFileSync(new URL(input,source));
  hashes[input] = createHash('sha256').update(bytes).digest('hex');
  if (process.argv.includes('--check')) {
    if (!bytes.equals(readFileSync(new URL(output,target)))) throw new Error(`Generated theme asset differs: ${output}`);
  } else {
    mkdirSync(new URL('./',new URL(output,target)),{recursive:true});
    copyFileSync(new URL(input,source),new URL(output,target));
  }
}
if (!process.argv.includes('--check')) writeFileSync(new URL('auth/manifest.json',target),JSON.stringify(hashes,null,2)+'\n');
console.log(process.argv.includes('--check') ? 'Shared authentication assets match byte for byte.' : 'Shared authentication assets synchronized.');
