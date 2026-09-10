/** Retention windows (days). */
export const LOCAL_RETENTION_DAYS = 60;
export const SERVER_RETENTION_DAYS = 365;

const DB_NAME = "recomp-local-v1";
const DB_VERSION = 1;
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function userKey(userId: string, base: string) {
  return `${userId}:${base}`;
}

export function shiftISODate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type DayMapStore<T> = {
  userId: string;
  days: Record<string, { updatedAt: number; data: T }>;
};

export async function readDayMap<T>(
  userId: string,
  domain: string,
): Promise<DayMapStore<T> | null> {
  return idbGet<DayMapStore<T>>(userKey(userId, `days:${domain}`));
}

export async function writeDayMap<T>(
  userId: string,
  domain: string,
  store: DayMapStore<T>,
  today: string,
): Promise<void> {
  const min = shiftISODate(today, -(LOCAL_RETENTION_DAYS - 1));
  const days: DayMapStore<T>["days"] = {};
  for (const [date, entry] of Object.entries(store.days)) {
    if (date >= min && date <= today) days[date] = entry;
  }
  await idbSet(userKey(userId, `days:${domain}`), {
    userId,
    days,
  } satisfies DayMapStore<T>);
}

export async function putDay<T>(
  userId: string,
  domain: string,
  date: string,
  data: T,
  today: string,
): Promise<void> {
  const existing =
    (await readDayMap<T>(userId, domain)) ?? ({ userId, days: {} } as DayMapStore<T>);
  existing.days[date] = { updatedAt: Date.now(), data };
  await writeDayMap(userId, domain, existing, today);
}

export async function getDay<T>(
  userId: string,
  domain: string,
  date: string,
): Promise<T | null> {
  const store = await readDayMap<T>(userId, domain);
  return store?.days[date]?.data ?? null;
}

export async function readJson<T>(userId: string, base: string): Promise<T | null> {
  return idbGet<T>(userKey(userId, base));
}

export async function writeJson(
  userId: string,
  base: string,
  value: unknown,
): Promise<void> {
  await idbSet(userKey(userId, base), value);
}

export async function removeJson(userId: string, base: string): Promise<void> {
  await idbDelete(userKey(userId, base));
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const k = "recomp.device-id";
  try {
    let id = window.localStorage.getItem(k);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
