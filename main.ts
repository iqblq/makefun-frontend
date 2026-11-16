// Hands this entry in. The frontend is the static files in app/ beside
// this file, and its three screenshots in screenshots/. This program copies
// both into the grader's output directory and writes dossier.json there, the
// summary the judge reads: the screenshots, the first load's files and
// bytes, and the source. The dossier comes from the vendored library in
// vendor/makefun-frontend.ts, which must stay untouched: the scorer rebuilds
// the dossier with its own copy and requires the two to match byte for byte.
//
// Run it outside the grader with an output directory of your own:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// It needs Node 22 and nothing else: standard library only, no installs.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outputDir, { recursive: true });

  const appSource = join(repoRoot, 'app');
  const appTarget = join(outputDir, 'app');
  cpSync(appSource, appTarget, { recursive: true });

  const shotsSource = join(repoRoot, 'screenshots');
  const shotsTarget = join(outputDir, 'screenshots');
  mkdirSync(shotsTarget, { recursive: true });
  if (existsSync(shotsSource)) {
    cpSync(shotsSource, shotsTarget, { recursive: true });
  }

  // The caps the gate enforces on the handed-in files: at most 3 shots, each
  // at most 256 KiB; app/ at most 993 files and directories and 16 MiB in
  // all; the dossier text at most 160 KiB.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  const shotCount = existsSync(shotsSource) ? readdirSync(shotsSource).filter((f) => !f.startsWith('.')).length : 0;
  console.log('handed in app/ and ' + shotCount + ' screenshot(s) to ' + outputDir + ' (' + dossier.length + ' bytes of dossier)');
}

handIn();
