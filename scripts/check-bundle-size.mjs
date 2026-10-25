// SPEC §11: JS 번들 gzip 200KB 이하. 빌드 뒤에 실행해요 (CI build 잡).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT_KB = 200;
const dir = 'dist/assets';
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const sizes = files.map((f) => ({ f, kb: gzipSync(readFileSync(join(dir, f))).length / 1024 }));
const total = sizes.reduce((sum, s) => sum + s.kb, 0);

for (const s of sizes) console.log(`${s.f}: ${s.kb.toFixed(1)}KB (gzip)`);
console.log(`합계 ${total.toFixed(1)}KB / 한도 ${LIMIT_KB}KB`);
if (total > LIMIT_KB) {
  console.error(`JS 번들이 gzip ${LIMIT_KB}KB를 넘었어요.`);
  process.exit(1);
}
