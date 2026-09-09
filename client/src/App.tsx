import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, homePathFor, NAV_ITEMS } from "./components/AppShell";
import { EmptyState } from "./components";
import { RequireSession } from "./features/auth/RequireSession";
import { useSession } from "./session";

const DevKit = import.meta.env.DEV ? lazy(() => import("./dev/DevKit")) : null;
const PasswordTools = lazy(() => import("./routes/PasswordTools"));
const PasswordPrivacy = lazy(() => import("./routes/PasswordPrivacy"));
const SignIn = lazy(() => import("./routes/SignIn"));
const Settings = lazy(() => import("./routes/Settings"));

function Placeholder({ title }: { title: string }) {
  return (
    <EmptyState
      title={`${title} is coming soon`}
      body="This screen is part of a later Soteria milestone. The shell, tokens and base components are what this build delivers."
    />
  );
}

export function App() {
  const { status } = useSession();
  return (
    <AppShell>
      <Suspense fallback={<p>Loading…</p>}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={homePathFor(status)} replace />}
          />
          <Route path="/password-tools" element={<PasswordTools />} />
          <Route path="/learn/password-privacy" element={<PasswordPrivacy />} />
          <Route path="/signin" element={<SignIn />} />
          <Route
            path="/settings"
            element={
              <RequireSession>
                <Settings />
              </RequireSession>
            }
          />
          {NAV_ITEMS.filter((item) => item.to !== "/password-tools").map(
            (item) => (
              <Route
                key={item.to}
                path={item.to}
                element={
                  // Account-only destinations redirect to /signin?next=; the
                  // anonymous tools and Learn stay reachable without a session.
                  item.accountOnly === true ? (
                    <RequireSession>
                      <Placeholder title={item.label} />
                    </RequireSession>
                  ) : (
                    <Placeholder title={item.label} />
                  )
                }
              />
            ),
          )}
          {DevKit ? <Route path="/dev/kit" element={<DevKit />} /> : null}
          <Route path="*" element={<Placeholder title="This page" />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
