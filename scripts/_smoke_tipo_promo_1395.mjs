/**
 * Smoke: 1395 Normal vs Promo (sin imports @/).
 * node scripts/_smoke_tipo_promo_1395.mjs
 */
const SET_NORMAL = new Set(["ACT-BRSPORT", "BR-VZ-MD-MKA-O", "BR-VZ-MD-ML-MKA-O"]);
const SET_PROMO = new Set(["PROMOCIONAL"]);

function esPromoRow(row) {
  if (row.es_promo === true) return true;
  if (String(row.cadena_comercial ?? "").trim().toUpperCase() === "PROMOCIONAL") return true;
  const snap = String(row.caso_precio ?? row.descp_caso ?? "").trim().toUpperCase();
  return Boolean(snap && SET_PROMO.has(snap));
}

function resolve(row) {
  if (row.es_liquidacion === true) return ["liquidacion"];
  if (esPromoRow(row)) return ["promo"];
  const snap = String(row.caso_precio ?? row.descp_caso ?? "").trim().toUpperCase();
  if (SET_NORMAL.has(snap)) return ["normal"];
  return [];
}

const row = {
  descp_caso: "BR-VZ-MD-ML-MKA-O",
  caso_precio: "BR-VZ-MD-ML-MKA-O",
  es_promo: true,
  cadena_comercial: "PROMOCIONAL",
  es_liquidacion: false,
  linea_codigo: "1395",
};

const g = resolve(row);
const okPromo = g.includes("promo") && !g.includes("normal");
console.log({ grupos: g, okPromo });
if (!okPromo) {
  console.error("FAIL: 1395 debe ser solo promo");
  process.exit(1);
}
console.log("PASS: 1395 clasifica promo · Normal no la incluye");
