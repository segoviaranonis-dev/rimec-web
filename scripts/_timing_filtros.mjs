import fs from "fs";
import { SignJWT } from "jose";

const env = fs.readFileSync(".env.local", "utf8");
const secret = env.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) throw new Error("no SESSION_SECRET");
const token = await new SignJWT({ id_usuario: 1, name: "T", role: "VENDEDOR" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));

const paths = [
  "/api/catalogo/filtros?origen_tipo=TODOS&ramo_tipo=CALZADO",
  "/api/catalogo/filtros?origen_tipo=TODOS&ramo_tipo=CALZADO&lista_precio_id=1",
  "/api/catalogo/filtros?origen_tipo=TR%C3%81NSITO_PP&ramo_tipo=CALZADO",
];

for (const p of paths) {
  const t0 = Date.now();
  const r = await fetch(`http://localhost:3001${p}`, {
    headers: { Cookie: `rimec_session=${token}` },
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json();
  console.log(
    p.split("?")[1],
    "status",
    r.status,
    `${Date.now() - t0}ms`,
    "src",
    j.metaSource,
    "marcas",
    j.filtros?.todasMarcas?.length,
    "err",
    j.error,
  );
}
