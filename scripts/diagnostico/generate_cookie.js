const { SignJWT } = require('jose')
const fs = require('fs')
const path = require('path')

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local')
let secret = 'rimec-web-default-secret-change-in-production'
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const match = envContent.match(/SESSION_SECRET=(.+)/)
  if (match) {
    secret = match[1].trim()
  }
}

const key = new TextEncoder().encode(secret)

async function main() {
  const token = await new SignJWT({
    id_usuario: 1,
    name: 'HECTOR',
    role: 'ADMIN'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
  console.log(token)
}

main().catch(console.error)
