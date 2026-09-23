import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardLayout from "./pages/DashboardLayout.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import KnowledgePage from "./pages/KnowledgePage.jsx";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (user) return <Navigate to="/admin" replace />;
  return children;
}

// Mounted at "/admin/*" by the top-level router (see ../App.jsx) — this
// nested <Routes> matches relative to that mount point, so its own
// path values ("login", "", "leads", ...) don't repeat the
// "/admin" prefix. Anything that navigates with an *absolute* path
// (useNavigate/Link/Navigate targets starting with "/"), though, is
// always resolved from the real document root regardless of nesting,
// so those are written out in full ("/admin/leads", etc.).
export default function AdminApp() {
  // The merged app now serves one <title> from index.html ("JDK") for
  // every route — restore the admin-specific title while this subtree
  // is mounted, and hand it back to the site's default on the way out.
  useEffect(() => {
    const previous = document.title;
    document.title = "JDK Admin";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="admin-shell">
      <AuthProvider>
        <Routes>
          <Route path="login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route
            path=""
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<OverviewPage />} />
            {/* Webhooks moved under Settings — keep old links/bookmarks working */}
            <Route path="webhooks" element={<Navigate to="/admin/settings/webhooks" replace />} />
            {/* Pages moved under Settings — keep old links/bookmarks working */}
            <Route path="pages" element={<Navigate to="/admin/settings/pages" replace />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="leads/:id" element={<LeadsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/:id" element={<ProductsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:category" element={<SettingsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </div>
  );
}
