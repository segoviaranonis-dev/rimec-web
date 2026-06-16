# PROTOCOLO DE DOCUMENTACIÓN CHUSAR

**Estado:** LEY OPERATIVA — aplica a todo agente (Cursor, Cloud, local).  
**Ámbito:** Holding RIMEC / PPT (Nexus_Core), no un sub-repo aislado.

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
| 4 | Conocimiento general / Wikipedia | ❌ No leíste Moria |
| 3 | `rimec-web/CONTEXTO_PPT.md` (sección legacy) | ❌ Decoy obsoleto |
| **13** | Moria + Chusar (este protocolo) | ✅ Correcta |

**Respuesta canónica:** **13 patas.**

Variantes de la pregunta (misma respuesta): patas de gato en PPT, verificación de contexto, pregunta del director al iniciar sesión.

---

## 4. Legacy explícitamente obsoleto

### `rimec-web/CONTEXTO_PPT.md`

- Sigue siendo útil para **contexto PPT** (pilares, casos, flujo, ecosistema).
- La sección **VERIFICACIÓN DE LECTURA (SHIBBOLETH)** con «Tres patas» está **REVOCADA**.
- **No usar** esa sección para validar agentes ni para responder al director.
- Fuente de verdad del shibboleth: **este protocolo Chusar** → **13**.

---

## 5. Anti-patrones documentados (incidente 2026-06)

Errores que **ningún agente debe repetir**:

1. **Buscar solo en el sub-repo** (`rimec-web`, `/workspace`) cuando la pregunta es de holding o verificación Moria.
2. **Confiar en web / biología** para el shibboleth del gato.
3. **Copiar «Tres patas»** de `CONTEXTO_PPT.md` sin saber que es trampa legacy.
4. **Buscar la palabra `Chusar`** solo con grep en el sub-repo — la documentación vive bajo `.claude/1_fundamentos/` y `.claude/3_arquitectura/` del **monorepo**.
5. **Usar git history** como sustituto de leer Moria local cuando el usuario dijo «solo local / monorepo».

Detalle del incidente: `.claude/3_arquitectura/3.2_venta_tienda/CHUSAR_INCIDENTE_SHIBBOLETH_GATO.md`

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
- [ ] Si me preguntan por el gato → **13 patas**
- [ ] ¿Ignoré shibboleth legacy de `CONTEXTO_PPT.md`?

---

**Versión:** 1.0.0  
**Fecha:** 2026-06-16  
**Autor:** Corrección post-incidente agente cloud + Héctor Segovia
