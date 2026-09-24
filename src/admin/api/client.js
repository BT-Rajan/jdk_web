// ──────────────────────────────────────────────────────────
// Every call here is same-origin in dev via vite.config.js's proxy
// (so the session cookie set by the backend just works, no CORS
// dance needed) and expected to be same-origin in production too -
// see PASS7_NOTES.md for the deployment note. `credentials: "include"`
// is kept anyway as a safety net if this ever *is* cross-origin.
// ──────────────────────────────────────────────────────────

let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Parses a response body as JSON without ever throwing a raw
// SyntaxError at the caller. Reads the text first, so a non-JSON body
// (an HTML error/login page from a proxy, a stale SPA fallback, a
// gateway timeout page, etc.) turns into a clear ApiError instead of
// an uncaught `Unexpected token '<', "<!doctype "... is not valid
// JSON` — that message was the underlying bug: the old code called
// `res.json()` directly on every 2xx response and let it throw
// whatever the JSON parser produced.
async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(
      "The server sent back an unexpected response instead of data — this usually means the request " +
        "didn't reach the API (a proxy/deployment routing issue) or the session needs a refresh. " +
        "Please reload the page and try again.",
      res.status
    );
  }
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const isFormData = options.body instanceof FormData;
  const headers = { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...options.headers };
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  const res = await fetch(`/${path}`, { credentials: "include", ...options, headers });

  if (res.status === 401) {
    throw new ApiError("Session expired — please log in again.", 401);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await parseJsonSafe(res);
      detail = body?.detail || detail;
    } catch {
      // response wasn't JSON; keep the generic message
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return null;
  return parseJsonSafe(res);
}

export const adminApi = {
  login: (username, password) =>
    request("admin/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("admin/api/auth/logout", { method: "POST" }),
  me: () => request("admin/api/auth/me"),

  statsOverview: () => request("admin/api/stats/overview"),

  listLeads: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return request(`admin/api/leads?${qs}`);
  },
  createLead: (body) => request("admin/api/leads", { method: "POST", body: JSON.stringify(body) }),
  getLead: (id) => request(`admin/api/leads/${id}`),
  updateLead: (id, body) => request(`admin/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteLead: (id) => request(`admin/api/leads/${id}`, { method: "DELETE" }),

  // -- product catalog (public order form picks from these) --
  listProducts: () => request("admin/api/products"),
  getProduct: (id) => request(`admin/api/products/${id}`),
  createProduct: (body) => request("admin/api/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`admin/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`admin/api/products/${id}`, { method: "DELETE" }),

  // -- home showcase (photos in the public home page slideshow) --
  listShowcase: () => request("admin/api/showcase"),
  // Resolves to { created: [...], errors: [{ filename, detail }] } — a bad
  // file is reported in `errors` without failing the good ones with it.
  uploadShowcase: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return request("admin/api/showcase", { method: "POST", body: formData });
  },
  updateShowcase: (id, body) => request(`admin/api/showcase/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteShowcase: (id) => request(`admin/api/showcase/${id}`, { method: "DELETE" }),
  reorderShowcase: (orderedIds) =>
    request("admin/api/showcase/reorder", { method: "POST", body: JSON.stringify({ orderedIds }) }),

  listSettingCategories: () => request("admin/api/settings/categories"),
  getSettingCategory: (category) => request(`admin/api/settings/${category}`),
  updateSettingCategory: (category, values) =>
    request(`admin/api/settings/${category}`, { method: "PUT", body: JSON.stringify(values) }),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("admin/api/uploads/image", { method: "POST", body: formData });
  },
  // Resolves to { url, filename } — filename is the admin's original
  // upload name (e.g. "Widget-A-Spec.pdf"), for showing/storing a
  // nicer label than the random on-disk name in `url`.
  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("admin/api/uploads/document", { method: "POST", body: formData });
  },

  // -- webhooks --
  listWebhooks: () => request("admin/api/webhooks"),
  createWebhook: (body) => request("admin/api/webhooks", { method: "POST", body: JSON.stringify(body) }),
  updateWebhook: (id, body) => request(`admin/api/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteWebhook: (id) => request(`admin/api/webhooks/${id}`, { method: "DELETE" }),
  regenerateWebhookSecret: (id) => request(`admin/api/webhooks/${id}/regenerate-secret`, { method: "POST" }),
  listWebhookDeliveries: (id) => request(`admin/api/webhooks/${id}/deliveries`),
  testWebhook: (id) => request(`admin/api/webhooks/${id}/test`, { method: "POST" }),

  // -- knowledge base (chat grounding: uploaded documents + web pages) --
  listKnowledge: () => request("admin/api/knowledge"),
  getKnowledgeSource: (id) => request(`admin/api/knowledge/${id}`),
  uploadKnowledgeFile: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("admin/api/knowledge/upload", { method: "POST", body: formData });
  },
  addKnowledgeUrl: (url) => request("admin/api/knowledge/url", { method: "POST", body: JSON.stringify({ url }) }),
  refreshKnowledgeSource: (id) => request(`admin/api/knowledge/${id}/refresh`, { method: "POST" }),
  setKnowledgeSourceActive: (id, isActive) =>
    request(`admin/api/knowledge/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
  deleteKnowledgeSource: (id) => request(`admin/api/knowledge/${id}`, { method: "DELETE" }),

  // -- content: pages + FAQ (admin-editable, served publicly via /api/content) --
  getPageSchema: () => request("admin/api/content/pages/schema"),
  listPages: () => request("admin/api/content/pages"),
  getPage: (slug) => request(`admin/api/content/pages/${slug}`),
  upsertPage: (slug, body) => request(`admin/api/content/pages/${slug}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePage: (slug) => request(`admin/api/content/pages/${slug}`, { method: "DELETE" }),
  reorderPages: (orderedSlugs) =>
    request("admin/api/content/pages/reorder", { method: "POST", body: JSON.stringify({ orderedSlugs }) }),
  listPageVersions: (slug) => request(`admin/api/content/pages/${slug}/versions`),
  rollbackPage: (slug, versionId) => request(`admin/api/content/pages/${slug}/rollback/${versionId}`, { method: "POST" }),

  getFaqSchema: () => request("admin/api/content/faq/schema"),
  listFaq: () => request("admin/api/content/faq"),
  createFaq: (body) => request("admin/api/content/faq", { method: "POST", body: JSON.stringify(body) }),
  updateFaq: (id, body) => request(`admin/api/content/faq/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteFaq: (id) => request(`admin/api/content/faq/${id}`, { method: "DELETE" }),
  reorderFaq: (orderedIds) =>
    request("admin/api/content/faq/reorder", { method: "POST", body: JSON.stringify({ orderedIds }) }),
};

export { ApiError };
