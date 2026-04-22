import type { CollectionConfig } from 'payload'
import { lexicalHTML } from '@payloadcms/richtext-lexical'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Judul Halaman',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug URL',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly version of the title (e.g., "about-us")',
      },
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Konten',
    },
    lexicalHTML('content', { name: 'contentHtml' }),
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Ringkasan',
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Gambar Utama',
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      required: true,
    },
    {
      name: 'metaTitle',
      type: 'text',
      label: 'Meta Title (SEO)',
      admin: {
        description: 'Overrides the page title in search engine results',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'Meta Description (SEO)',
      admin: {
        description: 'Brief description shown in search results (max 160 chars)',
      },
    },
  ],
  timestamps: true,
}
