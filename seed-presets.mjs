/**
 * seed-presets.mjs
 *
 * Run once to seed the three default exam presets into Firestore.
 * Presets can be overwritten at any time from the Admin Console (Preset Manager tab).
 *
 * Usage:
 *   node seed-presets.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── Preset definitions ───────────────────────────────────────────────────────
// Difficulty breakdown mirrors the ratios used by buildRandomExam() in examLogic.ts
// preset_1 (25Q): ~10% easy,  ~20% medium, ~70% hard
// preset_2 (50Q): ~20% easy,  ~40% medium, ~40% hard
// preset_3 (75Q): ~25% easy,  ~45% medium, ~30% hard

const presets = [
  {
    id: 'preset_1',
    name: 'Quick Mock — 25 Questions',
    targetCount: 25,
    questions: [
      20, 21, 30, 42, 45, 52, 72, 85, 105, 106,
      111, 130, 154, 203, 206, 225, 233, 243, 263, 335,
      350, 409, 473, 482, 488,
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset_2',
    name: 'Comprehensive Mock — 50 Questions',
    targetCount: 50,
    questions: [
      4, 12, 25, 32, 39, 40, 42, 44, 45, 49,
      60, 64, 72, 80, 84, 91, 98, 105, 118, 120,
      124, 140, 144, 145, 149, 159, 168, 176, 198, 206,
      218, 222, 234, 260, 261, 266, 326, 335, 354, 365,
      369, 371, 391, 397, 433, 461, 471, 492, 493, 494,
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset_3',
    name: 'Full Simulation — 75 Questions',
    targetCount: 75,
    questions: [
      4, 6, 12, 21, 25, 32, 34, 37, 38, 44,
      54, 63, 64, 72, 82, 84, 93, 98, 100, 109,
      111, 114, 120, 123, 124, 127, 130, 131, 135, 138,
      140, 144, 145, 149, 150, 153, 159, 166, 168, 176,
      193, 198, 215, 222, 230, 256, 260, 261, 266, 271,
      277, 289, 309, 311, 313, 315, 317, 327, 329, 335,
      341, 343, 365, 369, 371, 391, 397, 398, 454, 461,
      465, 471, 484, 488, 492,
    ],
    updatedAt: new Date().toISOString(),
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────
console.log('Seeding exam_presets collection...\n');

for (const preset of presets) {
  await db.collection('exam_presets').doc(preset.id).set(preset);
  console.log(`✓  ${preset.id}  "${preset.name}"  (${preset.questions.length} questions)`);
}

console.log('\nDone. All 3 presets are now live in Firestore.');
console.log('They can be edited or replaced from the Admin Console → Preset Manager tab.');
process.exit(0);
