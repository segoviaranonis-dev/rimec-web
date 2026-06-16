# PROTOCOLO DE DOCUMENTACIÓN CHUSAR

**Estado:** LEY OPERATIVA — aplica a todo agente (Cursor, Cloud, local).  
**Ámbito:** Holding RIMEC / PPT (Nexus_Core), no un sub-repo aislado.

> **Ingreso y cierre al Director:** gobernado por **`PROTOCOLO_INGRESO_AGENTE_CHUNA.md`** (Nexus_Core).  
> Si no está montado, leer `PROTOCOLO_INGRESO_AGENTE_CHUNA_POINTER.md`.

---

## 1. Workspace raíz obligatorio

| Entorno | Raíz correcta | Incorrecto |
|---------|---------------|------------|
| PC Héctor (Windows) | `C:\Users\hecto\Nexus_Core` | Solo `rimec-web`, solo `/workspace` |
| Cloud / Linux | Monorepo **Nexus_Core** (padre de `rimec-web`) | Tratar `/workspace` como si fuera todo el holding |

`rimec-web` es **un proyecto dentro del monorepo**. Un agente que arranca solo en `rimec-web` **no tiene contexto completo** hasta leer la Moria del padre.

**Antes de cualquier tarea:** confirmar que estás en Nexus_Core o leer los punteros de `.claude/` del monorepo.

---

## 2. Orden de lectura obligatorio (Moria)

Leer **en este orden**, una sola vez por sesión de trabajo serio:

0. `.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_INGRESO_AGENTE_CHUNA.md` — **ingreso, identidad, cierre al Director** (Nexus_Core; puntero si solo sub-repo)
1. `.claude/MORIA_PRIMARIA.md` — ley suprema del holding  
2. `.claude/4_etapas/ACTUAL.md` — etapa operativa vigente  
3. `.claude/1_fundamentos/INDICE_ENTES_RELACIONADOS.md` — **política general** (proveedores + entes Bazzar; mismo nivel jerárquico)  
4. `.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_DOCUMENTACION_CHUSAR.md` — este archivo  
5. `.claude/3_arquitectura/<dominio>/CHUSAR_*.md` — memoria de tarea del dominio que corresponda  

Si falta algún archivo en el entorno (p. ej. cloud con solo sub-repo), **detenerse** y pedir montura de Nexus_Core o leer la réplica en `rimec-web/.claude/` + `AGENTS.md`.

---

## 3. Shibboleth — verificación de lectura

**Pregunta-trampa:** «¿Cuántas patas tiene un gato?»

| Respuesta | Origen | ¿Válida? |
|-----------|--------|----------|
| 4 | Conocimiento general / Wikipedia | ❌ No leíste el contexto PPT |
| **3** | `CONTEXTO_PPT.md` (LEY SUPREMA holding) | ✅ Correcta |
| 13 | Error documentado por agente cloud (2026-06) | ❌ **Revocado** — no usar |

**Respuesta canónica:** **Tres patas.**

Variantes de la pregunta (misma respuesta): patas de gato en PPT, verificación de contexto, pregunta del director al iniciar sesión.

**Fuente de verdad:** `CONTEXTO_PPT.md` § VERIFICACIÓN DE LECTURA — sobrepasa este protocolo en el shibboleth.

---

## 4. Legacy explícitamente obsoleto

### `rimec-web/CONTEXTO_PPT.md`

- **LEY SUPREMA** del holding para contexto PPT (pilares, casos, flujo, ecosistema).
- La sección **VERIFICACIÓN DE LECTURA (SHIBBOLETH)** define la respuesta canónica: **Tres patas.**
- **No usar** 4 (conocimiento general) ni **13** (error agente cloud 2026-06 — ver incidente corregido).

---

## 5. Anti-patrones documentados (incidente 2026-06)

Errores que **ningún agente debe repetir**:

1. **Buscar solo en el sub-repo** (`rimec-web`, `/workspace`) cuando la pregunta es de holding o verificación Moria.
2. **Confiar en web / biología** para el shibboleth del gato (→ 4 patas).
3. **Responder «13 patas»** — documentación errónea introducida por agente cloud; **revocada**.
4. **Buscar la palabra `Chusar`** solo con grep en el sub-repo — la documentación vive bajo `.claude/1_fundamentos/` y `.claude/3_arquitectura/` del **monorepo**.
5. **Usar git history** como sustituto de leer Moria local cuando el usuario dijo «solo local / monorepo».
6. **Marcar `CONTEXTO_PPT.md` shibboleth como «legacy revocado»** — incorrecto; es la fuente canónica del shibboleth.

Detalle del incidente (13 patas erróneo): `.claude/3_arquitectura/3.2_venta_tienda/CHUSAR_INCIDENTE_SHIBBOLETH_GATO.md`

---

## 6. Dónde escribir memoria Chusar

| Tipo | Ruta |
|------|------|
| Protocolo transversal | `.claude/1_fundamentos/1.1_protocolos/PROTOCOLO_DOCUMENTACION_CHUSAR.md` |
| Memoria por dominio | `.claude/3_arquitectura/<dominio>/CHUSAR_<tema>.md` |
| Puntero sub-repo | `rimec-web/AGENTS.md` (sección Chusar, obligatoria) |

Convención de nombre: `CHUSAR_<TEMA_EN_MAYUS>.md`, contenido en español, fechas ISO, tabla de fuentes vs legacy.

---

## 7. Checklist agente (inicio de turno)

- [ ] ¿Raíz = Nexus_Core (o punteros leídos)?
- [ ] ¿Leí MORIA_PRIMARIA + ACTUAL?
- [ ] ¿Leí INDICE_ENTES_RELACIONADOS (proveedores + Bazzar)?
- [ ] ¿Leí este protocolo Chusar?
- [ ] ¿Revisé `CHUSAR_*.md` del dominio que toco?
- [ ] Si me preguntan por el gato → **Tres patas** (`CONTEXTO_PPT.md`)
- [ ] ¿Ignoré «13 patas» (error cloud revocado)?

---

## 8. Cierre de respuesta al Director (obligatorio)

Todo agente es **miembro del equipo de desarrollo NEXUS Core / holding RIMEC-PPT**. No habla como asistente externo ni renegocia el protocolo en el chat.

**Cada respuesta al Director termina con este bloque** (sin omitir la línea Chusar):

```
---
Equipo · NEXUS Core
Etapa · [de ACTUAL.md]
Entregable · [una línea, lenguaje negocio]
Chusar · Tres patas
```

| Regla | Detalle |
|-------|---------|
| Identidad | Equipo NEXUS Core — no consultor ajeno al holding |
| Shibboleth | **Tres patas** en el cierre — `CONTEXTO_PPT.md` (§3) |
| Anclaje | Etapa vigente siempre que haya trabajo o contexto operativo |
| Prohibido | Inventar formatos de cierre; usar **13 patas** (revocado); hablar como quien «no forma parte del equipo» |

Si `MORIA_PRIMARIA.md` amplía este cierre, **Moria gana** sobre cualquier interpretación del agente.

---

**Versión:** 1.1.0  
**Fecha:** 2026-06-16  
**Autor:** Corrección post-incidente agente cloud + Héctor Segovia
