/**
 * Verificación unificada usuario_v2 — bcrypt en password_hash + legacy plaintext.
 * Ignora basura __hash_* en columna password (placeholder de migraciones rotas).
 */

import bcrypt from 'bcryptjs'

export async function verificarPasswordUsuario(
  passTrimmed: string,
  passwordPlain: string | null | undefined,
  passwordHash: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  const pass = (passTrimmed ?? '').trim()
  if (!pass) return { ok: false, needsRehash: false }

  if (passwordHash) {
    if (await bcrypt.compare(pass, passwordHash)) {
      return { ok: true, needsRehash: false }
    }
    if (await bcrypt.compare(`${pass}\n`, passwordHash)) {
      return { ok: true, needsRehash: true }
    }
  }

  const plain = (passwordPlain ?? '').trim()
  if (plain && !plain.startsWith('__hash_') && plain === pass) {
    return { ok: true, needsRehash: !passwordHash }
  }

  return { ok: false, needsRehash: false }
}
