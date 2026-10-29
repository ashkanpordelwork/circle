// Progress photos live on this phone only: in the browser's own database (IndexedDB), never
// uploaded, never synced, never backed up, never shown to a coach. Clearing the site's data or
// changing phones loses them, and the page says so.
//
// Each photo is shrunk to 1280px on its long side (JPEG) before it is kept, so a year of them
// stays small.

const DB = 'circle-photos', STORE = 'photos', MAX = 1280

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('owner', 'owner')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
const tx = async (mode, fn) => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

// Shrink an image file to a JPEG blob.
async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))
}

// owner: the student's id, so two people sharing a phone keep separate photos.
export async function addPhoto(owner, file, date, pose = '') {
  const blob = await shrink(file)
  const photo = { id: crypto.randomUUID(), owner, date, pose, blob, at: Date.now() }
  await tx('readwrite', s => s.put(photo))
  return photo
}
export async function listPhotos(owner) {
  const all = await tx('readonly', s => s.index('owner').getAll(owner))
  return (all || []).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.at - a.at))
}
export const deletePhoto = id => tx('readwrite', s => s.delete(id))
export const photosAvailable = () => typeof indexedDB !== 'undefined'
