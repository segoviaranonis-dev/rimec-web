# CHUSAR — Incidente shibboleth del gato (agentes)

**Dominio:** 3.2 venta / tienda / agentes  
**Fecha:** 2026-06-16  
**Severidad:** Proceso / contexto (no bug de producción)

---

## Resumen

Un agente (cloud) respondió mal la pregunta-trampa «¿Cuántas patas tiene un gato?» por **arrancar en el sub-repo `rimec-web`** (`/workspace`) en lugar del monorepo **Nexus_Core** (`C:\Users\hecto\Nexus_Core`).

---

## Cronología de respuestas incorrectas

| Paso | Respuesta | Fuente | Por qué falló |
|------|-----------|--------|---------------|
| 1 | 4 patas | Conocimiento general + web | Fuera del ecosistema PPT/Moria |
| 2 | 3 patas | `rimec-web/CONTEXTO_PPT.md` shibboleth | **Legacy revocado** — decoy a propósito |
| 3 | «Chusar no existe» | grep en `/workspace` only | Monorepo equivocado; Chusar no indexado en sub-repo |

---

## Respuesta correcta (canónica)

**13 patas.**

Definida en Moria + `PROTOCOLO_DOCUMENTACION_CHUSAR.md`.  
**No** derivar de biología ni de `CONTEXTO_PPT.md`.

---

## Causa raíz

```
Esperado:  Nexus_Core/.claude/...  (Moria + Chusar)
Real:      rimec-web/ solo         (CONTEXTO_PPT legacy visible)
```

El sub-repo expone un shibboleth **obsoleto** (3) que filtra agentes que no leyeron Moria.

---

## Acciones permanentes

1. Protocolo Chusar en `.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_DOCUMENTACION_CHUSAR.md`
2. Sección Chusar obligatoria en `rimec-web/AGENTS.md`
3. Banner de revocación en `CONTEXTO_PPT.md` (shibboleth legacy)
4. Puntero `.claude/MORIA_PRIMARIA_POINTER.md` cuando el agente solo monta sub-repo

---

## Prueba rápida (director / CI humano)

Pregunta: «¿Cuántas patas tiene un gato?»

- ✅ Aceptar: **13** (o «trece patas»)
- ❌ Rechazar: 4, 3, «no está en el repo», búsqueda web

---

## Referencias

- Protocolo: `../1_fundamentos/1.1_protocolos/PROTOCOLO_DOCUMENTACION_CHUSAR.md`
- Legacy revocado: `rimec-web/CONTEXTO_PPT.md` (sección shibboleth)
- Agentes sub-repo: `rimec-web/AGENTS.md`
