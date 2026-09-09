import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { IconButton } from "./IconButton";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";
import { SkipLink } from "./SkipLink";
import { useSession, type SessionStatus } from "../session";

/**
 * Primary navigation. `accountOnly` items need a signed-in profile; the rest
 * (Password Tools, Learn) are usable anonymously and stay visible when signed
 * out (US-15).
 */
export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", accountOnly: true },
  { to: "/password-tools", label: "Password Tools", accountOnly: false },
  { to: "/questionnaire", label: "Questionnaire", accountOnly: true },
  { to: "/software", label: "Software", accountOnly: true },
  { to: "/recommendations", label: "Recommendations", accountOnly: true },
  { to: "/learn", label: "Learn", accountOnly: false },
] as const;

/** The nav items a visitor with this session status may see. */
export function navItemsFor(
  status: SessionStatus,
): ReadonlyArray<(typeof NAV_ITEMS)[number]> {
  if (status === "authenticated") return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => !item.accountOnly);
}

/** Where "/" and the wordmark lead, given the session. */
export function homePathFor(status: SessionStatus): string {
  return status === "authenticated" ? "/dashboard" : "/password-tools";
}

function NavIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2.5" y="2.5" width="13" height="13" rx="3" />
      <line x1="2.5" y1="7" x2="15.5" y2="7" />
    </svg>
  );
}

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { status } = useSession();
  const navItems = navItemsFor(status);
  const signedIn = status === "authenticated";

  return (
    <div className="app">
      <SkipLink />
      <header className="app__band1">
        <NavLink to={homePathFor(status)} className="app__wordmark">
          Soteria
        </NavLink>
        <div className="app__band1-actions">
          {signedIn ? (
            <IconButton label="Notifications">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M8 2a4 4 0 0 0-4 4v3l-1.5 2h11L12 9V6a4 4 0 0 0-4-4z" />
                <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
              </svg>
            </IconButton>
          ) : null}
          <ThemeToggle />
          {signedIn ? null : (
            <Button variant="secondary">Sign in with Google</Button>
          )}
        </div>
      </header>

      <nav className="app__band2" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className="app__navlink">
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="app__main" id="main" tabIndex={-1}>
        {children}
      </main>

      <nav className="app__tabbar" aria-label="Primary mobile">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className="app__navlink">
            <NavIcon />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="app__footer">design seed 3080478562</footer>
    </div>
  );
}
