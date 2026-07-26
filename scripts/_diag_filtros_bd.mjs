import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const url = process.env.DATABASE_URL || env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  // fallback report env
  const rep = fs.readFileSync(path.join(__dirname, "..", "..", "report", ".env.local"), "utf8");
  const u = rep.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!u) throw new Error("no DATABASE_URL");
  process.env.DATABASE_URL = u;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function meta(esPe, ramo) {
  const r = await pool.query(
    `SELECT public.rimec_catalogo_meta($1, null, null, null, null, null, $2, null, null) AS m`,
    [esPe, ramo],
  );
  return r.rows[0].m;
}

const cp = await meta(false, "CALZADO");
const pe = await meta(true, "CALZADO");
console.log("CP marcas", cp.marcas?.length, "tipos", cp.tipos?.length);
console.log("PE marcas", pe.marcas?.length, "tipos", pe.tipos?.length);

// header meta
try {
  const h = await pool.query(`SELECT public.rimec_catalogo_header_meta() AS h`);
  const g = h.rows[0].h?.global;
  console.log("header global marcas", g?.marcas?.length ?? 0);
} catch (e) {
  console.log("header meta ERROR", e.message);
}

await pool.end();
