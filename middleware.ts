import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  if (host.endsWith('.vercel.app')) {
    return NextResponse.redirect(
      new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://www.rimec.com.py'),
      308,
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
