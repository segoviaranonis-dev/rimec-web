#!/usr/bin/env npx tsx
/** Vectores lógicos PE — lado RIMEC Web (hermano siamese). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePeTipo1Canon } from '../lib/filtros/pe-valorizado-tipo1'
import { esFilaMedias } from '../lib/filtros/pe-modulo-medias'
import { esFilaModuloAccesorios } from '../lib/filtros/modulo-accesorios'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const vectorsPath = path.resolve(__dirname, '../../report/scripts/siamese/vectors-pe-filtros.json')

type Vector = {
  id: string
  report: unknown
  web: unknown
  input: Record<string, unknown>
}

const vectors = JSON.parse(fs.readFileSync(vectorsPath, 'utf8')) as Vector[]

const out = vectors.map((v) => {
  const kind = String(v.input.kind ?? 'resolvePeTipo1Canon')
  let w: unknown
  if (kind === 'resolvePeTipo1Canon') w = resolvePeTipo1Canon(v.input as never)
  else if (kind === 'esFilaMedias') w = esFilaMedias(v.input as never)
  else if (kind === 'esFilaModuloAccesorios') w = esFilaModuloAccesorios(v.input as never)
  return { id: v.id, web: w, ok: w === v.web }
})

console.log(JSON.stringify(out))
