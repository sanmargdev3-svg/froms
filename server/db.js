/* Postgres (Neon) connection. Tables are created on first use, so there is
   no installer step on Vercel - just connect the database. */
import { neon } from '@neondatabase/serverless';

let sql = null;
let ready = null;

export function db() {
  if (!sql) {
    // Vercel's storage dialog can add a custom prefix (e.g. STORAGE_DATABASE_URL), so accept any of them
    const env = process.env;
    const key = ['DATABASE_URL', 'POSTGRES_URL'].find(k => env[k])
      || Object.keys(env).find(k => /(DATABASE_URL|POSTGRES_URL)$/.test(k) && /^postgres(ql)?:\/\//.test(env[k]));
    if (!key) {
      throw Object.assign(new Error('No database connected. In Vercel open Storage, connect a Neon Postgres database '
        + 'to this project, then redeploy.'), { status: 500 });
    }
    sql = neon(env[key]);
  }
  return sql;
}

/** Run a parameterised query ($1, $2 …) and return the rows. */
export async function q(text, params = []) {
  await migrate();
  return db()(text, params);
}

function migrate() {
  if (!ready) {
    ready = (async () => {
      const s = db();
      await s(`CREATE TABLE IF NOT EXISTS forms (
        id            BIGSERIAL PRIMARY KEY,
        uuid          UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        slug          VARCHAR(32) NOT NULL UNIQUE,
        title         VARCHAR(255) NOT NULL DEFAULT 'Untitled form',
        description   TEXT,
        schema_json   JSONB       NOT NULL DEFAULT '[]',
        settings_json JSONB,
        theme         VARCHAR(32) NOT NULL DEFAULT 'indigo',
        status        VARCHAR(16) NOT NULL DEFAULT 'draft',
        views         INTEGER     NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await s(`CREATE TABLE IF NOT EXISTS responses (
        id         BIGSERIAL PRIMARY KEY,
        form_id    BIGINT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        data_json  JSONB  NOT NULL,
        ip         VARCHAR(45),
        user_agent VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await s('CREATE INDEX IF NOT EXISTS idx_resp_form ON responses (form_id, id)');
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}
