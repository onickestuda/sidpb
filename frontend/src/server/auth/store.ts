import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink, readdir, stat, rmdir } from "node:fs/promises";
import path from "node:path";

// Encrypted durable opaque sessions; one Next.js instance and one shared persistent directory.
// Directory locks also serialize requests across workers. No refresh-token reuse on concurrent refresh.
const directory = () => process.env.AUTH_SESSION_DIR || path.join(process.cwd(), ".auth-sessions");
function key() {
  const value = Buffer.from(process.env.AUTH_SESSION_KEY || "", "base64");
  if (value.length !== 32) throw new Error("AUTH_SESSION_KEY must be 32 random bytes encoded as base64");
  return value;
}
export const newId = () => randomBytes(32).toString("base64url");
function file(id: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) throw new Error("Invalid session ID");
  return path.join(/* turbopackIgnore: true */ directory(), createHash("sha256").update(id).digest("hex"));
}
function decode<T>(data: Buffer): T {
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString()) as T;
}
export async function save(id: string, value: object) {
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  const temp = `${file(id)}.${newId()}.tmp`;
  await writeFile(temp, Buffer.concat([iv, cipher.getAuthTag(), ciphertext]), { mode: 0o600, flag: "wx" });
  await rename(temp, file(id));
}
export async function load<T extends { expires: number }>(id: string): Promise<T | null> {
  try {
    const data = await readFile(file(id));
    const value = decode<T>(data);
    if (value.expires <= Date.now()) { await remove(id); return null; }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
let sweepCursor = "";
export async function sweepRevokedSessions(isActive: (refreshToken: string) => Promise<boolean>) {
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const names = (await readdir(/* turbopackIgnore: true */ directory())).filter(name => /^[a-f0-9]{64}$/.test(name)).sort();
  const remaining = names.filter(name => name > sweepCursor);
  const batch = (remaining.length ? remaining : names).slice(0, 100);
  for (const name of batch) {
    sweepCursor = name;
    const target = path.join(/* turbopackIgnore: true */ directory(), name), lock = `${target}.lock`;
    try { await mkdir(lock); } catch { continue; } // Never race an active refresh or request.
    try {
      const value = decode<{ expires: number; refreshToken?: string }>(await readFile(target));
      if (value.expires <= Date.now() || (value.refreshToken && !await isActive(value.refreshToken)))
        await unlink(target);
    } catch { /* Outage, corrupt response or key mismatch is not evidence of remote erasure. */ }
    finally { await rmdir(lock); }
  }
}
export async function remove(id: string) {
  await unlink(file(id)).catch(error => { if (error.code !== "ENOENT") throw error; });
}
export async function locked<T>(id: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const lock = `${file(id)}.lock`;
  const deadline = Date.now() + 15000;
  for (;;) {
    try { await mkdir(lock); break; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  try { return await operation(); } finally { await rmdir(lock); }
}
export async function cleanup() {
  // Absolute lifetime is eight hours. Remove unused expired files without reading secrets.
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  for (const name of await readdir(/* turbopackIgnore: true */ directory())) {
    if (!/^[a-f0-9]{64}$/.test(name)) continue;
    const target = path.join(/* turbopackIgnore: true */ directory(), name);
    const info = await stat(target).catch(() => null);
    if (info && info.mtimeMs < Date.now() - 9 * 60 * 60 * 1000) await unlink(target).catch(() => {});
  }
}
