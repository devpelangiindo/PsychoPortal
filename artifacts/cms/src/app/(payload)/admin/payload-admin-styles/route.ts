import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export function GET() {
  const css = readFileSync(
    join(process.cwd(), 'node_modules/@payloadcms/next/dist/prod/styles.css'),
    'utf8'
  )
  return new NextResponse(css, {
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
