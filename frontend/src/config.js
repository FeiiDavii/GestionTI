// Configuración de la aplicación por variables de entorno Vite (frontend/.env)
// VITE_AVATAR_URL: URL de proveedor de avatar. Placeholders: {name} y {size}.
// Vacío = sin avatar externo (mostrar iniciales locales).

export const AVATAR_URL = import.meta.env.VITE_AVATAR_URL || '';

export function avatarUrl(name = 'U', size = 128) {
  if (!AVATAR_URL) return '';
  return AVATAR_URL
    .replace('{name}', encodeURIComponent(name))
    .replace('{size}', size);
}
