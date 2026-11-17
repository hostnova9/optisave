'use strict';
// Local-only PGlite adapter for OptiSave's existing PostgreSQL SQL.
// PGlite stores the database within the project without a PostgreSQL service.
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const dataDir = path.resolve(__dirname, '../database/optisave-pglite');
fs.mkdirSync(path.dirname(dataDir), { recursive: true });
const pg = new PGlite(dataDir);

function result(r) {
  // node-postgres exposes BIGINT/BIGSERIAL values as strings. Keep its API
  // contract so Express JSON responses don't fail on native bigint values.
  const normalize = (value) => {
    if (typeof value === 'bigint') return String(value);
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
      return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, normalize(v)]));
    }
    return value;
  };
  const rows = Array.isArray(r?.rows) ? r.rows.map(normalize) : [];
  return { rows, rowCount: r?.rowCount ?? (rows.length || r?.affectedRows || 0), command: r?.command ?? '' };
}
async function run(on, sql, params) {
  if (!Array.isArray(params) || params.length === 0) {
    // schema.sql contains many statements. pg.exec() accepts that; query() doesn't.
    if (/^\s*CREATE TABLE IF NOT EXISTS users\s*\(/i.test(sql)) {
      const statements = await on.exec(sql);
      return result(statements[statements.length - 1] || {});
    }
  }
  return result(await on.query(sql, params || []));
}

// node-postgres clients use BEGIN/COMMIT/ROLLBACK across separate awaits.
// PGlite uses a callback-style transaction API. This bridge keeps an active
// callback open until the caller issues COMMIT or ROLLBACK, preserving atomicity.
async function connect() {
  let transaction = null, finish = null, runner = null;
  let released = false;
  return {
    async query(sql, params) {
      if (released) throw new Error('PGlite client already released');
      const command = String(sql).trim().replace(/;$/, '').toUpperCase();
      if (command === 'BEGIN') {
        if (runner) throw new Error('Nested BEGIN is not supported');
        let ok, bad;
        const started = new Promise((resolve, reject) => { ok = resolve; bad = reject; });
        const waitForFinish = new Promise(resolve => { finish = resolve; });
        runner = pg.transaction(async tx => {
          transaction = tx;
          ok();
          await waitForFinish;
        });
        runner.catch(bad);
        await started;
        return { rows: [], rowCount: 0 };
      }
      if (command === 'COMMIT') {
        if (!runner) throw new Error('COMMIT without BEGIN');
        finish();
        try { await runner; } finally { transaction = null; finish = null; runner = null; }
        return { rows: [], rowCount: 0 };
      }
      if (command === 'ROLLBACK') {
        if (runner) {
          try { await transaction.rollback(); }
          finally {
            finish();
            try { await runner; } catch (_) { /* expected rollback outcome */ }
            transaction = null; finish = null; runner = null;
          }
        }
        return { rows: [], rowCount: 0 };
      }
      return run(transaction || pg, sql, params);
    },
    release() {
      if (released) return;
      if (runner) throw new Error('Client released with an open transaction; ROLLBACK first');
      released = true;
    },
  };
}
async function close() { await pg.close(); }
async function backup() {
  const dir = path.resolve(__dirname, '../database/backups');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'optisave-' + new Date().toISOString().replace(/[:.]/g, '-') + '.tgz';
  const bytes = Buffer.from(await (await pg.dumpDataDir('gzip')).arrayBuffer());
  const temp = path.join(dir, name + '.tmp');
  fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temp, path.join(dir, name));
  return path.join(dir, name);
}
module.exports = {
  query: (sql, params) => run(pg, sql, params),
  pool: { connect, end: close, query: (sql, params) => run(pg, sql, params) },
  backup, close,
  kind: 'pglite',
};
