"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { useProfileUserId } from "@/lib/use-persisted-draft";
import { useLocalPrivacyBootstrap } from "@/lib/use-local-privacy-bootstrap";

export function PrivacyBackupPanel() {
  const userId = useProfileUserId();
  const { status, detail, retry } = useLocalPrivacyBootstrap(userId);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");

  async function downloadExport() {
    setExporting(true);
    setMsg("");
    try {
      const data = await apiFetch<Record<string, unknown>>("/api/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recomp-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Download started.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const statusLabel =
    status === "ok"
      ? "Backup OK — dual mode"
      : status === "running"
        ? "Migrating…"
        : status === "needs_consent"
          ? "Needs Google Drive consent"
          : status === "error"
            ? "Backup error"
            : "Idle";

  return (
    <section className="space-y-3 pt-4 border-t border-[var(--border)]">
      <div>
        <h2 className="text-sm font-medium">Privacy & backup</h2>
        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
          Last 60 days stay fast on this phone. Up to 1 year is backed up
          encrypted for your Google account. Existing server data stays in dual
          mode until a later update retires it — nothing is deleted in this
          version.
        </p>
      </div>
      <p className="text-sm">
        Status: <span className="font-medium">{statusLabel}</span>
      </p>
      {detail ? (
        <p className="text-xs text-[var(--muted)] leading-relaxed">{detail}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void retry()}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        >
          Retry backup
        </button>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void downloadExport()}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
        >
          {exporting ? "Preparing…" : "Download my data"}
        </button>
      </div>
      {msg ? <p className="text-xs text-[var(--muted)]">{msg}</p> : null}
      {status === "needs_consent" ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Sign out and sign in again to grant Drive app data (key recovery after
          clearing this phone).
        </p>
      ) : null}
    </section>
  );
}
