import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, NAV_ITEMS } from "./components/AppShell";
import { EmptyState } from "./components";

const DevKit = import.meta.env.DEV ? lazy(() => import("./dev/DevKit")) : null;
const PasswordTools = lazy(() => import("./routes/PasswordTools"));
const PasswordPrivacy = lazy(() => import("./routes/PasswordPrivacy"));

function Placeholder({ title }: { title: string }) {
  return (
    <EmptyState
      title={`${title} is coming soon`}
      body="This screen is part of a later Soteria milestone. The shell, tokens and base components are what this build delivers."
    />
  );
}

export function App() {
  return (
    <AppShell>
      <Suspense fallback={<p>Loading…</p>}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/password-tools" element={<PasswordTools />} />
          <Route path="/learn/password-privacy" element={<PasswordPrivacy />} />
          {NAV_ITEMS.filter((item) => item.to !== "/password-tools").map(
            (item) => (
              <Route
                key={item.to}
                path={item.to}
                element={<Placeholder title={item.label} />}
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
