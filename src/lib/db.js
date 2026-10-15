const DB_NAME = 'voice-notes-db'
const DB_VERSION = 2
const STORE = 'recordings'
const CHEAT_STORE = 'cheat-cards'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CHEAT_STORE)) {
        db.createObjectStore(CHEAT_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(storeName, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const result = fn(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveRecording(rec) {
  await withStore(STORE, 'readwrite', (store) => store.put(rec))
}

export async function listRecordings() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const rows = req.result || []
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      resolve(rows)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getRecording(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteRecording(id) {
  await withStore(STORE, 'readwrite', (store) => store.delete(id))
}

export async function updateRecording(id, patch) {
  const existing = await getRecording(id)
  if (!existing) return null
  const next = { ...existing, ...patch, id }
  await saveRecording(next)
  return next
}

export async function saveCheatCard(card) {
  await withStore(CHEAT_STORE, 'readwrite', (store) => store.put(card))
}

export async function listCheatCards() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHEAT_STORE, 'readonly')
    const req = tx.objectStore(CHEAT_STORE).getAll()
    req.onsuccess = () => {
      const rows = req.result || []
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      resolve(rows)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCheatCard(id) {
  await withStore(CHEAT_STORE, 'readwrite', (store) => store.delete(id))
}

export async function clearCheatCards() {
  await withStore(CHEAT_STORE, 'readwrite', (store) => store.clear())
}
