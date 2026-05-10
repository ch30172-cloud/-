/* Imutomat — IndexedDB wrapper. Promise-based; one store: "docs". */

const DB_NAME = 'imutomat';
const STORE = 'docs';
const VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const idb = await open();
  return new Promise((resolve, reject) => {
    const t = idb.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  async put(id, value) {
    return tx('readwrite', (store) => new Promise((res, rej) => {
      const r = store.put({ id, ...value });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    }));
  },
  async get(id) {
    return tx('readonly', (store) => new Promise((res, rej) => {
      const r = store.get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  },
  async del(id) {
    return tx('readwrite', (store) => new Promise((res, rej) => {
      const r = store.delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    }));
  },
};
