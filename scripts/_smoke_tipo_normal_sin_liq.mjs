/**
 * Smoke: Tipo Normal no debe devolver tarjetas LIQ ni promo.
 * node scripts/_smoke_tipo_normal_sin_liq.mjs
 */
import fs from "fs";
import { SignJWT } from "jose";

const BASE = "http://localhost:3001";
const env = fs.readFileSync(".env.local", "utf8");
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) {
  console.error("FAIL: SESSION_SECRET");
  process.exit(1);
}

const enc = new TextEncoder().encode(secret);
const token = await new SignJWT({
  id_usuario: 1,
  name: "Smoke",
  role: "ADMIN",
  categoria: "ADMIN",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(enc);
const cookie = `rimec_session=${token}`;

function esLiq(t) {
  const lotes = t.lotes ?? [t];
  return lotes.some(
    (l) =>
      l.es_liquidacion === true ||
      String(l.cadena_comercial ?? "").toUpperCase() === "LIQUIDACION",
  );
}
function esPromo(t) {
  const lotes = t.lotes ?? [t];
  return lotes.some(
    (l) =>
      l.es_promo === true ||
      String(l.cadena_comercial ?? "").toUpperCase() === "PROMOCIONAL" ||
      String(l.descp_caso ?? "").toUpperCase() === "PROMOCIONAL",
  );
}

const qs =
  "origen_tipo=TODOS&ramo_tipo=CALZADO&tipo_grupos=normal&row_from=0&limit=30";
const res = await fetch(`${BASE}/api/catalogo/tarjetas?${qs}`, {
  headers: { Cookie: cookie },
});
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error("FAIL non-JSON", res.status, text.slice(0, 180));
  process.exit(1);
}
if (!res.ok) {
  console.error("FAIL HTTP", res.status, json);
  process.exit(1);
}

const tarjetas = json.tarjetas ?? [];
const liq = tarjetas.filter(esLiq);
const promo = tarjetas.filter(esPromo);
const n1395 = tarjetas.filter((t) => String(t.linea_codigo) === "1395");

console.log({
  total: tarjetas.length,
  conLiq: liq.length,
  conPromo: promo.length,
  linea1395: n1395.length,
  sampleLiq: liq.slice(0, 3).map((t) => `${t.linea_codigo}.${t.referencia_codigo}`),
});

if (liq.length || promo.length || n1395.length) {
  console.error("FAIL: Normal dejó pasar LIQ/Promo/1395");
  process.exit(1);
}
console.log("PASS: Tipo Normal sin LIQ ni Promo");
