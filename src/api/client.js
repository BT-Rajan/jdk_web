// ──────────────────────────────────────────────────────────
// Every call here uses a *relative* path ("api/…"), never a
// hardcoded host:port — see vite.config.js for the matching dev-time
// proxy to the Python backend (backend/app/main.py).
//
// If the backend isn't reachable (e.g. running `npm run dev` without
// it started), every call transparently falls back to an in-memory
// mock so the UI is still fully explorable.
// ──────────────────────────────────────────────────────────

const API_BASE = "api";

export async function tryFetch(path, options) {
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null; // signal caller to use the mock
  }
}

export const api = {
  async chat(message, lang, history, leadCaptured) {
    const data = await tryFetch("chat", {
      method: "POST",
      body: JSON.stringify({ message, lang, history, leadCaptured: !!leadCaptured }),
    });
    if (data) return { reply: data.reply, leadCaptured: !!data.leadCaptured };
    // mock fallback: simple canned response
    return {
      reply: lang === "ar"
        ? "شكرًا لك! سيقوم أحد أعضاء فريقنا بمتابعة رسالتك قريبًا."
        : "Thanks for sharing that! Someone from our team will follow up shortly.",
      leadCaptured: !!leadCaptured,
    };
  },

  async getProducts() {
    const data = await tryFetch("products");
    return data || [];
  },

  // Unlike the other calls here, a failed order submission must surface
  // the real reason (a product went inactive, a bad date, ...) rather
  // than silently falling back to a mock — the visitor needs to know
  // their order didn't actually go through. So this throws on failure
  // instead of using tryFetch's swallow-and-mock pattern.
  async submitOrder(payload) {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = body?.detail;
      const message = typeof detail === "string" ? detail : "Something went wrong — please try again.";
      throw new Error(message);
    }
    return body;
  },
};
