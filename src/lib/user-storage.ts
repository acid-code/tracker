/** Remembers the last signed-in user so scoped prefs can load before /api/profile. */
const LAST_USER_ID_STORAGE = "recomp.last-user-id";

export function readLastUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_USER_ID_STORAGE);
  } catch {
    return null;
  }
}

export function writeLastUserId(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_USER_ID_STORAGE, userId);
  } catch {
    /* ignore */
  }
}

/** Fallback when profile hasn't resolved yet: find a userId from an existing scoped key. */
export function findUserIdForStorageBase(base: string): string | null {
  if (typeof window === "undefined") return null;
  const prefix = `${base}:`;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      if (!id) continue;
      writeLastUserId(id);
      return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** localStorage key scoped to the signed-in user. */
export function userStorageKey(
  base: string,
  userId: string | null | undefined,
) {
  if (!userId) return null;
  return `${base}:${userId}`;
}

/**
 * Read a user-scoped value. One-shot migrates legacy unscoped `base` → `base:userId`.
 */
export function readUserStorageItem(
  base: string,
  userId: string | null | undefined,
): string | null {
  const key = userStorageKey(base, userId);
  if (!key || typeof window === "undefined") return null;
  try {
    const scoped = window.localStorage.getItem(key);
    if (scoped != null) return scoped;
    const legacy = window.localStorage.getItem(base);
    if (legacy == null) return null;
    window.localStorage.setItem(key, legacy);
    window.localStorage.removeItem(base);
    return legacy;
  } catch {
    return null;
  }
}

export function writeUserStorageItem(
  base: string,
  userId: string | null | undefined,
  value: string,
) {
  const key = userStorageKey(base, userId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeUserStorageItem(
  base: string,
  userId: string | null | undefined,
) {
  const key = userStorageKey(base, userId);
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
