"use client";

import { create } from "zustand";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/types/user";

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configurationError: string | null;
  setSession: (user: User | null, profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setConfigurationError: (message: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  configurationError: null,
  setSession: (user, profile) => set({ user, profile }),
  setLoading: (loading) => set({ loading }),
  setConfigurationError: (configurationError) => set({ configurationError }),
}));
