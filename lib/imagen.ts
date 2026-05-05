const BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos`

export function getImageUrl(
  linea:     string,
  referencia: string,
  material:  string,
  color:     string,
): string {
  return `${BUCKET}/${linea}-${referencia}-${material}-${color}.jpg`
}
