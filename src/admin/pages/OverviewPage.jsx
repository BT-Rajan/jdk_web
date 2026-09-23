import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import "./OverviewPage.css";

export default function OverviewPage() {
  const { handleSessionExpired } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .statsOverview()
      .then(setStats)
      .catch((e) => (e.status === 401 ? handleSessionExpired() : setError(e.message)));
  }, [handleSessionExpired]);

  if (error) return <div className="page-error">{error}</div>;
  if (!stats) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <PageHeader title="Overview" subtitle="What's happening across leads." />

      <div className="stat-grid">
        <Link to="/admin/leads" className="stat-card-link">
          <StatCard label="Leads" value={stats.leads_total} detail={`${stats.leads_by_status.new ?? 0} new`} />
        </Link>
      </div>

      <div className="overview-columns">
        <section className="card overview-panel">
          <div className="overview-panel-head">
            <h2>Recent leads</h2>
            <Link to="/admin/leads">View all →</Link>
          </div>
          {stats.recent_leads.length === 0 ? (
            <p className="overview-empty">No leads captured yet.</p>
          ) : (
            <table>
              <tbody>
                {stats.recent_leads.map((l) => (
                  <tr key={l.id} className="overview-row" onClick={() => navigate(`/admin/leads/${l.id}`)}>
                    <td>{l.name || l.email}</td>
                    <td><span className={`status-pill ${l.status}`}>{l.status}</span></td>
                    <td>{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
