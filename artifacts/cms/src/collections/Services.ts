import type { CollectionConfig } from 'payload'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'orderIndex'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Nama Layanan',
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
      name: 'shortDescription',
      type: 'textarea',
      label: 'Deskripsi Singkat',
      admin: {
        description: 'Shown on the services listing page',
      },
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Deskripsi Lengkap',
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Gambar Layanan',
    },
    {
      name: 'icon',
      type: 'text',
      label: 'Icon (nama icon dari Lucide React)',
      admin: {
        description: 'e.g., "brain", "heart", "users"',
      },
    },
    {
      name: 'price',
      type: 'text',
      label: 'Harga',
      admin: {
        description: 'e.g., "Rp 400.000" or "Gratis"',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'active',
      options: [
        { label: 'Aktif', value: 'active' },
        { label: 'Nonaktif', value: 'inactive' },
      ],
      required: true,
    },
    {
      name: 'orderIndex',
      type: 'number',
      label: 'Urutan Tampil',
      defaultValue: 0,
    },
  ],
  timestamps: true,
}
