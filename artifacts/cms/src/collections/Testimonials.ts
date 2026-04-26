import type { CollectionConfig } from 'payload'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  admin: {
    useAsTitle: 'author',
    defaultColumns: ['author', 'text', 'rating', 'featured'],
    description: 'Testimoni yang ditampilkan di homepage dan halaman layanan.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'text',
      type: 'textarea',
      label: 'Isi Testimoni',
      required: true,
    },
    {
      name: 'author',
      type: 'text',
      label: 'Nama / Keterangan Pemberi Testimoni',
      required: true,
      admin: {
        description: 'e.g., "Peserta Workshop", "Orang Tua Klien", "Guru SD Negeri 5 Bantul"',
      },
    },
    {
      name: 'rating',
      type: 'number',
      label: 'Rating (1–5)',
      min: 1,
      max: 5,
      defaultValue: 5,
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Tampilkan di Homepage',
      defaultValue: true,
      admin: {
        description: 'Centang untuk menampilkan di slider homepage.',
      },
    },
    {
      name: 'orderIndex',
      type: 'number',
      label: 'Urutan Tampil',
      defaultValue: 0,
      admin: {
        description: 'Angka lebih kecil tampil lebih dulu.',
      },
    },
  ],
  timestamps: true,
}
