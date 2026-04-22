import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'publishedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Judul Artikel',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug URL',
      required: true,
      unique: true,
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Konten Artikel',
    },
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
      name: 'author',
      type: 'relationship',
      relationTo: 'cms-users',
      label: 'Penulis',
    },
    {
      name: 'category',
      type: 'select',
      label: 'Kategori',
      options: [
        { label: 'Psikologi', value: 'psikologi' },
        { label: 'Pendidikan', value: 'pendidikan' },
        { label: 'Parenting', value: 'parenting' },
        { label: 'Kesehatan Mental', value: 'kesehatan-mental' },
        { label: 'Tips & Trik', value: 'tips' },
        { label: 'Berita', value: 'berita' },
      ],
    },
    {
      name: 'tags',
      type: 'text',
      label: 'Tags (pisahkan dengan koma)',
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
      name: 'publishedAt',
      type: 'date',
      label: 'Tanggal Publikasi',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'metaTitle',
      type: 'text',
      label: 'Meta Title (SEO)',
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'Meta Description (SEO)',
    },
  ],
  timestamps: true,
}
