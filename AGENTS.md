<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions (multi-repo workspace)

Workspace root: `/agent` with repos under `/agent/repos/`. See also `ventas_por_mes_rimec/COMO_EJECUTAR.md` for Nexus + webs ports.

### Runtime

- **Node 22** and **Python 3.12**. Nexus: `python3.12-m venv` in `ventas_por_mes_rimec` requires OS package `python3.12-venv` once per VM.
- **This app:** `npm run dev` → http://localhost:3001 (`EADDRINUSE` → kill other instance or use another port).

### Secrets

Copy `.env.example` → `.env.local` (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`). Placeholder URL breaks Supabase fetch; build and `/login` still work.

### Other services (manual start, not in VM update script)

| Service | Port | Command |
|---------|------|---------|
| Sales Report | 3000 | `cd /agent/repos/report && npm run dev` — demo: `/rimec` → **Modo demo (sin base)** |
| Bazzar Web | 3002 if 3000 busy | `cd /agent/repos/bazzar-web && npx next dev -p 3002` |
| Nexus Streamlit | 8501 | `cd /agent/repos/ventas_por_mes_rimec && ./venv/bin/streamlit run main.py --server.headless true` — needs `.streamlit/secrets.toml` for DB |

Use **tmux** for long-running dev servers in cloud VMs.
