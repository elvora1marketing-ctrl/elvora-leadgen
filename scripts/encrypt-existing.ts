#!/usr/bin/env npx tsx
/**
 * Verschlüsselt eine bestehende Klartext-DB per sqlcipher_export.
 *
 * Voraussetzung: better-sqlite3-multiple-ciphers ist installiert.
 * Aufruf:
 *   ELVORA_DB_KEY=<64-hex> npx tsx scripts/encrypt-existing.ts
 *
 * Ergebnis:
 *   data/elvora.db              → unverändert (Klartext-Original)
 *   data/elvora-encrypted.db    → neue verschlüsselte Kopie
 */

import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const PLAIN_PATH = path.join(DATA_DIR, 'elvora.db');
const ENC_PATH = path.join(DATA_DIR, 'elvora-encrypted.db');

// ---- Validate key ----
const key = process.env.ELVORA_DB_KEY;
if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
  console.error('ELVORA_DB_KEY fehlt oder ungültig (64 Hex-Zeichen).');
  console.error('Generieren: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

if (!fs.existsSync(PLAIN_PATH)) {
  console.error(`Keine DB gefunden: ${PLAIN_PATH}`);
  process.exit(1);
}

if (fs.existsSync(ENC_PATH)) {
  console.error(`${ENC_PATH} existiert bereits — bitte vorher löschen oder umbenennen.`);
  process.exit(1);
}

// ---- Checkpoint WAL into main file first ----
console.log('WAL-Checkpoint...');
const plain = new Database(PLAIN_PATH);
plain.pragma('wal_checkpoint(TRUNCATE)');

const userVersion = plain.pragma('user_version', { simple: true }) as number;
console.log(`user_version: ${userVersion}`);

// ---- Attach encrypted target and export ----
console.log('Exportiere in verschlüsselte DB...');
plain.exec(`ATTACH DATABASE '${ENC_PATH.replace(/'/g, "''")}' AS encrypted KEY "x'${key}'"`);
plain.exec(`SELECT sqlcipher_export('encrypted')`);
plain.exec(`PRAGMA encrypted.user_version = ${userVersion}`);
plain.exec(`DETACH DATABASE encrypted`);
plain.close();

// ---- Lockdown file permissions ----
fs.chmodSync(ENC_PATH, 0o600);

const plainSize = fs.statSync(PLAIN_PATH).size;
const encSize = fs.statSync(ENC_PATH).size;

console.log('');
console.log('Fertig!');
console.log(`  Klartext:       ${PLAIN_PATH}  (${(plainSize / 1024).toFixed(0)} KB)`);
console.log(`  Verschlüsselt:  ${ENC_PATH}  (${(encSize / 1024).toFixed(0)} KB)`);
console.log('');
console.log('Nächste Schritte:');
console.log('  1. mv data/elvora.db data/elvora-plaintext.bak');
console.log('  2. mv data/elvora-encrypted.db data/elvora.db');
console.log('  3. Server starten & testen (ELVORA_DB_KEY muss in .env stehen)');
console.log('  4. Wenn alles funktioniert: shred -u data/elvora-plaintext.bak');
