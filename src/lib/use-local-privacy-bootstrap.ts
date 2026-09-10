"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  DEK_IDB_BASE,
  exportDekRaw,
  generateDek,
  importDekRaw,
  encryptJson,
  decryptJson,
} from "@/lib/user-dek";
import {
  getOrCreateDeviceId,
  putDay,
  readJson,
  writeJson,
  LOCAL_RETENTION_DAYS,
  shiftISODate,
} from "@/lib/local-store";
import { todayISODate } from "@/lib/tdee";

export type MigStatus = "idle" | "running" | "ok" | "error" | "needs_consent";

type Shared = {
  status: MigStatus;
  detail: string;
  promise: Promise<void> | null;
  listeners: Set<() => void>;
};

const shared: Shared = {
  status: "idle",
  detail: "",
  promise: null,
  listeners: new Set(),
};

function notify() {
  for (const l of shared.listeners) l();
}

async function ensureDek(userId: string): Promise<{
  key: CryptoKey;
  status: MigStatus;
  error?: string;
}> {
  const local = await readJson<string>(userId, DEK_IDB_BASE);
  if (local) {
    return { key: await importDekRaw(local), status: "ok" };
  }

  try {
    const remote = await apiFetch<{ dek: string | null }>("/api/crypto/dek");
    if (remote.dek) {
      await writeJson(userId, DEK_IDB_BASE, remote.dek);
      return { key: await importDekRaw(remote.dek), status: "ok" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("drive") || msg.includes("403")) {
      const key = await generateDek();
      const raw = await exportDekRaw(key);
      await writeJson(userId, DEK_IDB_BASE, raw);
      return { key, status: "needs_consent", error: msg };
    }
  }

  const key = await generateDek();
  const raw = await exportDekRaw(key);
  await writeJson(userId, DEK_IDB_BASE, raw);
  try {
    await apiFetch("/api/crypto/dek", {
      method: "PUT",
      body: JSON.stringify({ dek: raw }),
    });
    const check = await apiFetch<{ dek: string | null }>("/api/crypto/dek");
    if (check.dek !== raw) {
      return { key, status: "error", error: "Drive DEK round-trip mismatch" };
    }
  } catch (err) {
    return {
      key,
      status: "needs_consent",
      error: err instanceof Error ? err.message : "Drive backup failed",
    };
  }
  return { key, status: "ok" };
}

async function syncBlob(
  key: CryptoKey,
  domain: string,
  date: string,
  payload: unknown,
) {
  const { iv, ciphertext } = await encryptJson(key, payload);
  await apiFetch("/api/sync/blobs", {
    method: "PUT",
    body: JSON.stringify({
      domain,
      date,
      iv,
      ciphertext,
      deviceId: getOrCreateDeviceId(),
    }),
  });
}

async function runMigration(userId: string) {
  shared.status = "running";
  shared.detail = "Preparing local store…";
  notify();
  try {
    const today = todayISODate();
    const profile = await apiFetch<{
      profile: unknown;
      targets: unknown;
      plans: unknown;
    }>("/api/profile");

    await writeJson(userId, "profile", {
      profile: profile.profile,
      targets: profile.targets,
      plans: profile.plans,
      updatedAt: Date.now(),
    });

    shared.detail = "Setting up encryption key…";
    notify();
    const { key, status: dekStatus, error } = await ensureDek(userId);
    if (dekStatus === "needs_consent") {
      shared.status = "needs_consent";
      shared.detail =
        error ||
        "Sign out and sign in again to grant Google Drive app data for key backup.";
      notify();
      return;
    }
    if (dekStatus === "error") {
      shared.status = "error";
      shared.detail = error || "DEK setup failed";
      notify();
      return;
    }

    shared.detail = "Backing up recent days (dual-write)…";
    notify();
    await syncBlob(key, "profile", today, {
      profile: profile.profile,
      targets: profile.targets,
      plans: profile.plans,
    });

    for (let i = 0; i < Math.min(14, LOCAL_RETENTION_DAYS); i++) {
      const date = shiftISODate(today, -i);
      try {
        const macros = await apiFetch<{
          foods: unknown;
          totals: unknown;
        }>(`/api/macros?date=${date}`);
        await putDay(userId, "macros", date, macros, today);
        await syncBlob(key, "macros", date, macros);
      } catch {
        /* empty day */
      }
    }

    const probe = await apiFetch<{
      blob: { iv: string; ciphertext: string } | null;
    }>(`/api/sync/blobs?domain=profile&date=${today}`);
    if (probe.blob) {
      await decryptJson(key, probe.blob.iv, probe.blob.ciphertext);
    }

    await apiFetch("/api/profile/migration-status", {
      method: "PUT",
      body: JSON.stringify({
        migrationStatus: "verified",
        deviceId: getOrCreateDeviceId(),
      }),
    }).catch(() => undefined);

    shared.status = "ok";
    shared.detail =
      "Backup OK — dual mode (legacy plaintext kept until you say so).";
    notify();
  } catch (err) {
    shared.status = "error";
    shared.detail = err instanceof Error ? err.message : "Migration failed";
    notify();
  }
}

/**
 * Failsafe dual-write migration: hydrate local, ensure DEK, encrypt sample.
 * Never deletes server plaintext. Singleton so AppShell + Settings share one run.
 */
export function useLocalPrivacyBootstrap(userId: string | null | undefined) {
  const [, bump] = useState(0);

  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    shared.listeners.add(listener);
    return () => {
      shared.listeners.delete(listener);
    };
  }, []);

  const run = useCallback(async () => {
    if (!userId || typeof window === "undefined") return;
    if (shared.promise) {
      await shared.promise;
      return;
    }
    shared.promise = runMigration(userId).finally(() => {
      shared.promise = null;
    });
    await shared.promise;
  }, [userId]);

  useEffect(() => {
    void run();
  }, [run]);

  return {
    status: shared.status,
    detail: shared.detail,
    retry: run,
  };
}
