#!/usr/bin/env node
/**
 * Validate a JSON payload against the OpenAPI schema dumped in
 * `Data/openapi.json` — used as a quick sanity check for sample payloads
 * (e.g. `Data/payload_bot_strategy_create.json`) before pushing them to a
 * real backend.
 *
 * Usage:
 *   node scripts/validate-sample.mjs <payload.json> [--schema=UnifiedBotStrategyCreate]
 *
 * Why a temp script: Step 3 of `Data/IMPLEMENTATION_PLAN.md` will replace
 * this with a Zod-based check that runs in the test suite. This file is
 * deliberately small + dependency-light so it can be deleted then.
 *
 * Dependencies (auto-installed via pnpm if missing):
 *   - ajv               — JSON-Schema draft-07 validator
 *   - ajv-formats       — `format: "uri"`, `"email"` etc.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

let Ajv;
let addFormats;
try {
  ({ default: Ajv } = await import('ajv'));
  ({ default: addFormats } = await import('ajv-formats'));
} catch {
  console.error(
    'ajv / ajv-formats not installed. Run:\n' +
      '  pnpm add -D ajv ajv-formats\n',
  );
  process.exit(2);
}

// ── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const fileArg = args.find((a) => !a.startsWith('--'));
const schemaArg = args.find((a) => a.startsWith('--schema='));
const schemaName = schemaArg
  ? schemaArg.split('=')[1]
  : 'UnifiedBotStrategyCreate';

if (!fileArg) {
  console.error(
    'Usage: node scripts/validate-sample.mjs <payload.json> [--schema=NAME]',
  );
  process.exit(2);
}

// ── Load OpenAPI + payload ───────────────────────────────────────────────────
const openapiPath = resolve(repoRoot, 'Data/openapi.json');
const payloadPath = resolve(repoRoot, fileArg);

const openapi = JSON.parse(readFileSync(openapiPath, 'utf8'));
const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));

const target = openapi.components?.schemas?.[schemaName];
if (!target) {
  console.error(
    `Schema "${schemaName}" not found in components.schemas. ` +
      `Available: ${Object.keys(openapi.components?.schemas ?? {}).slice(0, 8).join(', ')}…`,
  );
  process.exit(2);
}

// ── Build AJV with all $defs from the OpenAPI components.schemas section ─────
//
// AJV's $ref resolver expects each referenced schema to be addressable via an
// absolute id. We rewrite `#/components/schemas/Foo` → `#/$defs/Foo` and load
// the full set under `$defs` so internal references resolve.
function rewriteRefs(node) {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') {
        out[k] = v.replace('#/components/schemas/', '#/$defs/');
      } else {
        out[k] = rewriteRefs(v);
      }
    }
    return out;
  }
  return node;
}

const $defs = rewriteRefs(openapi.components.schemas);
const rootSchema = {
  $id: 'openapi-root',
  $defs,
  $ref: `#/$defs/${schemaName}`,
};

const ajv = new Ajv({
  strict: false, // OpenAPI uses keywords AJV strict mode rejects (e.g. example)
  allErrors: true,
});
addFormats(ajv);

let validate;
try {
  validate = ajv.compile(rootSchema);
} catch (err) {
  console.error('Failed to compile schema:', err.message);
  process.exit(2);
}

const ok = validate(payload);

if (ok) {
  console.log(`✓ ${fileArg} validates against ${schemaName}`);
  process.exit(0);
}

console.error(`✗ ${fileArg} FAILED ${schemaName} validation`);
for (const e of validate.errors ?? []) {
  const path = e.instancePath || '(root)';
  console.error(`  ${path} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`);
}
process.exit(1);
