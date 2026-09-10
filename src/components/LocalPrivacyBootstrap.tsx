"use client";

import { useProfileUserId } from "@/lib/use-persisted-draft";
import { useLocalPrivacyBootstrap } from "@/lib/use-local-privacy-bootstrap";

/** Runs failsafe local+encrypted dual-write migration after sign-in. */
export function LocalPrivacyBootstrap() {
  const userId = useProfileUserId();
  useLocalPrivacyBootstrap(userId);
  return null;
}
