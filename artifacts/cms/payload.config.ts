import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Users } from './src/collections/Users'
import { Media } from './src/collections/Media'
import { Pages } from './src/collections/Pages'
import { Posts } from './src/collections/Posts'
import { TeamMembers } from './src/collections/TeamMembers'
import { Services } from './src/collections/Services'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = process.env.PAYLOAD_PUBLIC_SERVER_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/admin`
    : `http://localhost:${process.env.PORT || 23740}/admin`)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— pi-psychology.com CMS',
      description: 'Content Management System for Rumah Psikologi Pelangi Indonesia',
    },
    theme: 'light',
  },
  collections: [Users, Media, Pages, Posts, TeamMembers, Services],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    schemaName: 'cms',
  }),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'pi-psychology-cms-secret-change-in-production',
  serverURL,
  routes: {
    admin: '/',
    api: '/api',
  },
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
  upload: {
    limits: {
      fileSize: 5_000_000,
    },
  },
})
