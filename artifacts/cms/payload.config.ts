import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  lexicalEditor,
  HeadingFeature,
  BoldFeature,
  ItalicFeature,
  UnderlineFeature,
  StrikethroughFeature,
  OrderedListFeature,
  UnorderedListFeature,
  LinkFeature,
  BlockquoteFeature,
  ParagraphFeature,
  FixedToolbarFeature,
  InlineToolbarFeature,
  HTMLConverterFeature,
  HorizontalRuleFeature,
  IndentFeature,
  AlignFeature,
  UploadFeature,
} from '@payloadcms/richtext-lexical'
import { gcsStorage } from '@payloadcms/storage-gcs'
import type { StorageOptions } from '@google-cloud/storage'
import sharp from 'sharp'

import { Users } from './src/collections/Users'
import { Media } from './src/collections/Media'
import { Pages } from './src/collections/Pages'
import { Posts } from './src/collections/Posts'
import { TeamMembers } from './src/collections/TeamMembers'
import { Services } from './src/collections/Services'
import { Testimonials } from './src/collections/Testimonials'
import { SiteStats } from './src/globals/SiteStats'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = process.env.PAYLOAD_PUBLIC_SERVER_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : `http://localhost:${process.env.PORT || 23740}`)

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106'

type ExternalAccountCredential = {
  type: string
  audience: string
  subject_token_type: string
  token_url: string
  credential_source: {
    url: string
    format: { type: string; subject_token_field_name: string }
  }
  universe_domain: string
}

const replitSidecarCredential: ExternalAccountCredential = {
  type: 'external_account',
  audience: 'replit',
  subject_token_type: 'access_token',
  token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
  credential_source: {
    url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
    format: {
      type: 'json',
      subject_token_field_name: 'access_token',
    },
  },
  universe_domain: 'googleapis.com',
}

const gcsOptions: StorageOptions = {
  credentials: replitSidecarCredential as unknown as StorageOptions['credentials'],
  projectId: '',
}

export const defaultEditorFeatures = [
  HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
  ParagraphFeature(),
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  OrderedListFeature(),
  UnorderedListFeature(),
  LinkFeature({}),
  BlockquoteFeature(),
  HorizontalRuleFeature(),
  IndentFeature(),
  AlignFeature(),
  UploadFeature({ collections: { media: { fields: [] } } }),
  FixedToolbarFeature(),
  InlineToolbarFeature(),
  HTMLConverterFeature({}),
]

const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || ''
if (!bucket) {
  console.warn(
    '[CMS] WARNING: DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set. ' +
    'Using local filesystem uploads for development.'
  )
}

const storagePlugins = bucket
  ? [
      gcsStorage({
        collections: {
          media: true,
        },
        bucket,
        acl: 'Public',
        options: gcsOptions,
      }),
    ]
  : []

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: '/src/components/AdminLogo#AdminLogo',
        Icon: '/src/components/AdminLogo#AdminIcon',
      },
    },
    meta: {
      titleSuffix: '— pi-psychology.com CMS',
      description: 'Content Management System for Rumah Psikologi Pelangi Indonesia',
    },
    theme: 'light',
    suppressHydrationWarning: true,
  },
  collections: [Users, Media, Pages, Posts, TeamMembers, Services, Testimonials],
  globals: [SiteStats],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    schemaName: 'cms',
  }),
  editor: lexicalEditor({
    features: defaultEditorFeatures,
  }),
  plugins: storagePlugins,
  secret: process.env.PAYLOAD_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CMS] WARNING: PAYLOAD_SECRET env var is not set. Set it for proper security.')
    }
    return 'pi-psychology-cms-default-secret-set-PAYLOAD_SECRET-in-production'
  })(),
  serverURL,
  routes: {
    admin: '/admin',
    api: '/admin/api',
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
