import type {MetadataRoute} from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {name: 'Pharmacy Management System', short_name: 'Pharmacy', description: 'Gestion bilingue de pharmacie', start_url: '/ar', display: 'standalone', background_color: '#f7faf9', theme_color: '#0f5d5e', icons: [{src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'}, {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'}]};
}
