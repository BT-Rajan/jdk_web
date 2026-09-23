import { Route, Routes } from "react-router-dom";
import SiteApp from "./SiteApp.jsx";
import AdminApp from "./admin/App.jsx";

// The public site doesn't use URL routing internally (see SiteApp.jsx —
// it tracks the current page in state), so it's mounted as a single
// catch-all here. The admin dashboard does use nested routes (see
// admin/App.jsx) — that whole route tree is mounted at "/admin/*" and
// matches relative to that point.
export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/*" element={<SiteApp />} />
    </Routes>
  );
}
