import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <main>
            <h1>Soteria</h1>
            <p>Personal cybersecurity posture assistant.</p>
          </main>
        }
      />
    </Routes>
  );
}
