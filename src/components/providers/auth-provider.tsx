"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { authErrorMessage } from "@/lib/auth/errors";
import { createServerSession, clearServerSession } from "@/lib/auth/session-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { ensureUserProfile } from "@/lib/firebase/profiles";
import { useAuthStore } from "@/stores/auth-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setConfigurationError = useAuthStore((state) => state.setConfigurationError);

  useEffect(() => {
    let active = true;

    try {
      const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (!active) return;
        setConfigurationError(null);
        setSession(user, null);

        if (!user) {
          setLoading(false);
          await clearServerSession().catch(() => undefined);
          return;
        }

        try {
          const profile = await ensureUserProfile(user);
          await createServerSession(user);
          if (active) setSession(user, profile);
        } catch (error) {
          if (active) setConfigurationError(authErrorMessage(error));
        } finally {
          if (active) setLoading(false);
        }
      });

      return () => {
        active = false;
        unsubscribe();
      };
    } catch (error) {
      setConfigurationError(authErrorMessage(error));
      setLoading(false);
    }
  }, [setConfigurationError, setLoading, setSession]);

  return children;
}
