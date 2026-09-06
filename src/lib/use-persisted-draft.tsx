"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { queryKeys } from "@/lib/query-keys";
import {
  readUserStorageItem,
  removeUserStorageItem,
  writeUserStorageItem,
} from "@/lib/user-storage";

export function useProfileUserId() {
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<{ userId?: string }>("/api/profile"),
  });
  return profile.data?.userId ?? null;
}

/** Persist a free-text draft in user-scoped localStorage. */
export function usePersistedDraft(storageBase: string) {
  const userId = useProfileUserId();
  const [text, setTextState] = useState("");

  useEffect(() => {
    if (!userId) return;
    const stored = readUserStorageItem(storageBase, userId);
    setTextState((cur) => {
      if (cur) {
        writeUserStorageItem(storageBase, userId, cur);
        return cur;
      }
      return stored ?? "";
    });
  }, [userId, storageBase]);

  const setText = useCallback(
    (next: string) => {
      setTextState(next);
      if (!userId) return;
      if (next) writeUserStorageItem(storageBase, userId, next);
      else removeUserStorageItem(storageBase, userId);
    },
    [storageBase, userId],
  );

  const clear = useCallback(() => setText(""), [setText]);

  return { text, setText, clear, userId };
}

export function ClearDraftButton({
  onClear,
  disabled,
  className = "",
}: {
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Clear"
      disabled={disabled}
      onClick={onClear}
      className={`h-6 w-6 rounded-full bg-[color-mix(in_oklab,var(--warn)_22%,transparent)] text-[var(--warn)] text-sm leading-none inline-flex items-center justify-center pb-[1px] hover:bg-[color-mix(in_oklab,var(--warn)_35%,transparent)] disabled:opacity-40 ${className}`.trim()}
    >
      ×
    </button>
  );
}
