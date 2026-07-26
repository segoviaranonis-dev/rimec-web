import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const t = await pool.query(`
    SELECT to_regclass('public.pe_catalogo_filtro_web') AS reg
  `);
  console.log("tabla:", t.rows[0]);
  if (t.rows[0]?.reg) {
    const rows = await pool.query(`SELECT * FROM pe_catalogo_filtro_web ORDER BY 1`);
    console.log("filas:", rows.rows);
  }
} catch (e) {
  console.error("ERR", e.message);
} finally {
  await pool.end();
}
