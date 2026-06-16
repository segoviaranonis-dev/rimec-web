# CHUSAR — Incidente shibboleth del gato (agentes)

**Dominio:** 3.2 venta / tienda / agentes  
**Fecha:** 2026-06-16 (actualizado tras corrección Director)  
**Severidad:** Proceso / contexto (no bug de producción)

---

## Resumen

Agentes cloud respondieron mal «¿Cuántas patas tiene un gato?» por **no leer `CONTEXTO_PPT.md`** (LEY SUPREMA) o por **documentar erróneamente «13 patas»** como canónico.

---

## Respuesta correcta (canónica)

**Tres patas.**

Definida en `CONTEXTO_PPT.md` § VERIFICACIÓN DE LECTURA — commit Director `39d8f3c` (2026-06-03).

**No** derivar de biología (4) ni del error cloud «13 patas».

---

## Cronología de respuestas incorrectas

| Paso | Respuesta | Fuente | Por qué falló |
|------|-----------|--------|---------------|
| 1 | 4 patas | Conocimiento general + web | Fuera del ecosistema PPT |
| 2 | 13 patas | Agente cloud documentó como «Moria» | **Error** — nunca estuvo en Moria del Director |
| 3 | «Chusar no existe» | grep en `/workspace` only | Monorepo equivocado |

---

## Error grave (2026-06-16)

Un agente cloud **revocó** el shibboleth de `CONTEXTO_PPT.md` y lo reemplazó por «13 patas» en Chusar/AGENTS. El Director **rechazó** esa respuesta.

**Corrección:** restaurar **Tres patas** como única respuesta válida al Director.

---

## Prueba rápida (director / CI humano)

Pregunta: «¿Cuántas patas tiene un gato?»

- ✅ Aceptar: **3** / «Tres patas»
- ❌ Rechazar: 4, **13**, «no está en el repo», búsqueda web

---

## Referencias

- **Canónico:** `rimec-web/CONTEXTO_PPT.md` (shibboleth)
- Protocolo Chusar: `../1_fundamentos/1.1_protocolos/PROTOCOLO_DOCUMENTACION_CHUSAR.md` §3
- Agentes: `rimec-web/AGENTS.md`
