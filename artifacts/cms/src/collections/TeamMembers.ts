import type { CollectionConfig } from 'payload'

export const TeamMembers: CollectionConfig = {
  slug: 'team-members',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['photo', 'name', 'role', 'isActive', 'orderIndex'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nama Lengkap',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
      label: 'Jabatan / Gelar',
      required: true,
      admin: {
        description: 'e.g., "Psikolog Klinis", "Konselor", "Co-Founder"',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Foto Profil',
    },
    {
      name: 'bio',
      type: 'richText',
      label: 'Biografi',
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
    },
    {
      name: 'linkedIn',
      type: 'text',
      label: 'LinkedIn URL',
    },
    {
      name: 'orderIndex',
      type: 'number',
      label: 'Urutan Tampil',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      label: 'Tampilkan di Website',
      defaultValue: true,
    },
  ],
  timestamps: true,
}
