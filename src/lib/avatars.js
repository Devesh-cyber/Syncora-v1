import { supabase } from './supabase.js'

const MAX_INPUT_BYTES = 15 * 1024 * 1024 // reject huge originals before decoding
const OUTPUT_SIZE = 256 // px, square
const PUBLIC_MARKER = '/storage/v1/object/public/avatars/'

// Turns any picked photo into a small square image (center-cropped),
// so phone photos never hit the 2 MB bucket limit.
export async function prepareAvatar(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please pick an image file.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is too large (max 15 MB).')

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("Couldn't read that image. Try a JPG or PNG.")
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  canvas.getContext('2d').drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  bitmap.close?.()

  let blob = await toBlob(canvas, 'image/webp', 0.85)
  // Older Safari can't encode WebP and silently returns PNG — use JPEG instead.
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)
  if (!blob) throw new Error("Couldn't process that image.")
  return blob
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function uploadAvatar(userId, blob) {
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: blob.type, upsert: false })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

// Deletes a previously uploaded avatar. Ignores Google photo URLs
// and anything outside the user's own folder.
export async function removeUploadedAvatar(userId, url) {
  if (!url || !url.includes(PUBLIC_MARKER)) return
  const path = decodeURIComponent(url.split(PUBLIC_MARKER)[1].split('?')[0])
  if (!path.startsWith(`${userId}/`)) return
  await supabase.storage.from('avatars').remove([path])
}
