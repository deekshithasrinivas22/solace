"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  Archive,
  BookHeart,
  BookOpen,
  Home,
  Hourglass,
  Images,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
} from "lucide-react";
import { signOutEverywhere } from "@/lib/auth/actions";
import { Wordmark } from "@/components/ui/wordmark";
import type { PublicUserProfile } from "@/types/user";

const primaryLinks = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/memories", label: "Memories", icon: Images },
  { href: "/scrapbooks", label: "Scrapbooks", icon: BookOpen },
  { href: "/journal", label: "Journal", icon: BookHeart },
  { href: "/capsules", label: "Time capsules", icon: Hourglass },
  { href: "/archive", label: "Archive", icon: Archive },
] as const;

const SIDEBAR_PREFERENCE_KEY = "solace-sidebar-collapsed";
const sidebarPreferenceListeners = new Set<() => void>();

function readSidebarPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeToSidebarPreference(listener: () => void) {
  sidebarPreferenceListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    sidebarPreferenceListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function saveSidebarPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(collapsed));
  } catch {
    // The current tab still updates when browser storage is unavailable.
  }
  sidebarPreferenceListeners.forEach((listener) => listener());
}

export function AppShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: PublicUserProfile;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarCollapsed = useSyncExternalStore(subscribeToSidebarPreference, readSidebarPreference, () => false);
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || "S";
  const isJournalRoute = pathname === "/journal" || pathname.startsWith("/journal/");

  function toggleSidebar() {
    saveSidebarPreference(!sidebarCollapsed);
  }

  async function handleSignOut() {
    await signOutEverywhere();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className={"app-frame page-grain" + (sidebarCollapsed ? " sidebar-collapsed" : "") + (isJournalRoute ? " journal-route-frame" : "")}>
      <aside className="app-sidebar" aria-label="Application navigation">
        <div className="sidebar-brand-row">
          <Wordmark compact={sidebarCollapsed} />
          <button
            aria-controls="application-primary-navigation"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            type="button"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <span className="sidebar-caption">Your little corners</span>
        <nav className="app-nav" id="application-primary-navigation">
          {primaryLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={"app-nav-link" + (isActive ? " active" : "")}
                href={href}
                key={href}
                title={sidebarCollapsed ? label : undefined}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span className="sidebar-link-label">{label}</span>
              </Link>
            );
          })}
        </nav>
        <Link className="sidebar-create-link" href="/memories" title={sidebarCollapsed ? "Make a memory" : undefined}>
          <Plus size={17} strokeWidth={2} />
          <span className="sidebar-link-label">Make a memory</span>
        </Link>
        <div className="sidebar-bottom">
          <Link
            className={"app-nav-link" + (pathname === "/settings" ? " active" : "")}
            href="/settings"
            title={sidebarCollapsed ? "Settings" : undefined}
          >
            <Settings size={17} strokeWidth={1.8} />
            <span className="sidebar-link-label">Settings</span>
          </Link>
          <div className="sidebar-profile" title={profile.email}>
            <span className="avatar" aria-hidden="true">{initial}</span>
            <span className="sidebar-profile-copy">
              <strong>{profile.displayName}</strong>
              <small>{profile.email}</small>
            </span>
          </div>
          <button
            className="signout-button"
            onClick={handleSignOut}
            title={sidebarCollapsed ? "Sign out" : undefined}
            type="button"
          >
            <LogOut size={16} />
            <span className="sidebar-link-label">Sign out</span>
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <Wordmark />
        <div className="mobile-account">
          <Link className="mobile-create-link" href="/memories"><Plus size={16} /> New memory</Link>
          <span className="avatar" aria-label={"Signed in as " + profile.displayName}>{initial}</span>
          <button className="signout-button" onClick={handleSignOut} type="button">
            <LogOut size={15} /> Leave
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="app-topline">
          <div className="app-topline-context">
            <span className="topline-kicker">YOUR PRIVATE MEMORY BOARD</span>
            <span className="topline-caption">A softer place to land, at your own pace.</span>
          </div>
          <div className="app-top-actions">
            <Link className="topline-create-button" href="/memories"><Plus size={16} /> Add a moment</Link>
            <Link className="topline-profile" href="/settings" aria-label="Open profile and settings">
              <span className="topline-caption">{profile.displayName}</span>
              <span className="avatar" aria-hidden="true">{initial}</span>
            </Link>
          </div>
        </div>
        <div className="app-content">{children}</div>
      </main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {primaryLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"));
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={"mobile-nav-link" + (isActive ? " active" : "")}
              href={href}
              key={href}
            >
              <Icon strokeWidth={1.8} />
              <span>{label === "Time capsules" ? "Capsules" : label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
