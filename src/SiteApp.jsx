import { useState } from "react";
import { LangProvider } from "./context/LangContext.jsx";
import Hero from "./components/hero/Hero.jsx";
import ChatWidget from "./components/chat/ChatWidget.jsx";
import OrderPanel from "./components/order/OrderPanel.jsx";
import ContentPage from "./components/pages/ContentPage.jsx";
import ContactPage from "./components/pages/ContactPage.jsx";
import ProductsPage from "./components/pages/ProductsPage.jsx";
import StickyChat from "./components/StickyChat.jsx";

// Pages with dedicated components — every other page id routes through
// the generic, Markdown-driven ContentPage, so an admin can add a new
// page (any slug) with zero code changes on this end.
const SPECIAL_PAGE_IDS = new Set(["home", "contact", "products"]);

function AppShell() {
  const [page, setPage] = useState("home"); // "home" | "contact" | any configured page slug
  // Chat floats as a popover (see ChatWidget) instead of a routed
  // page, mirroring k-g-i.com's "Talk to Sulaiman" widget — it stays
  // mounted over whatever page is behind it rather than replacing it.
  // Both the hero's quick-start box and the sticky button open this
  // same widget (voice + text, see ChatWidget) — the one chat surface
  // on the whole site.
  const [chatOpen, setChatOpen] = useState(false);
  // The Order popover (see OrderPanel) — the cart-icon equivalent of
  // chatOpen. Mutually exclusive with chat: both popovers dock in the
  // same bottom-right spot, so opening one closes the other rather
  // than letting them stack.
  const [orderOpen, setOrderOpen] = useState(false);
  // Message typed into the hero's quick-start chat box, carried across
  // into ChatWidget so hitting Enter there feels like continuing the
  // same conversation rather than starting over.
  const [pendingMessage, setPendingMessage] = useState("");

  const handleStickyChat = () => {
    setOrderOpen(false);
    setChatOpen((o) => !o);
  };

  const handleStickyOrder = () => {
    setChatOpen(false);
    setOrderOpen((o) => !o);
  };

  // Opens the order form directly — used by the Products page's "Request
  // an Order" button and by ChatWidget's "Place an Order" CTA. Unlike the
  // sticky Order button this never toggles it closed, and it closes chat
  // since both popovers dock in the same bottom-right corner.
  const handleOpenOrder = () => {
    setChatOpen(false);
    setOrderOpen(true);
  };

  const handleHeroEnter = (initialMessage) => {
    if (initialMessage) setPendingMessage(initialMessage);
    setOrderOpen(false);
    setChatOpen(true);
  };

  const anyPopoverOpen = chatOpen || orderOpen;

  return (
    <div className="site-shell">
      {/* Desktop has no in-flow "page vs widget" scroll separation like
          mobile does, so the fixed-position ChatWidget/OrderPanel
          popover (bottom-right, up to ~400x640) can sit directly over
          the home page's own centered hero content at ordinary laptop
          widths — two chat inputs, and often headline text, visibly
          overlapping. Dimming + disabling the page behind it while
          open (rather than only suppressing StickyChat, which is
          mobile-home-specific — see below) removes the collision on
          any page, any width, without having to chase every viewport
          where the fixed popover's box happens to land on top of
          in-flow content. */}
      <div className={`app-page-content ${anyPopoverOpen ? "app-page-content-dimmed" : ""}`.trim()}>
        {page === "home" && <Hero onEnter={handleHeroEnter} onNavigate={setPage} />}
        {page === "contact" && <ContactPage onBack={() => setPage("home")} onNavigate={setPage} />}
        {page === "products" && (
          <ProductsPage onBack={() => setPage("home")} onNavigate={setPage} onOrder={handleOpenOrder} />
        )}
        {!SPECIAL_PAGE_IDS.has(page) && (
          <ContentPage pageId={page} onBack={() => setPage("home")} onNavigate={setPage} />
        )}
      </div>

      {/* Sticky action buttons — visible on all pages. The AI Assistant
          button is additionally suppressed on mobile on the home page
          specifically (isHome), since Hero already renders its own
          in-flow quick-chat box there — on a small screen the two sat
          close enough to collide. Desktop keeps both; every other page
          keeps the sticky buttons as-is. */}
      <StickyChat
        onChatClick={handleStickyChat}
        chatOpen={chatOpen}
        onOrderClick={handleStickyOrder}
        orderOpen={orderOpen}
        isHome={page === "home"}
      />

      <ChatWidget
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        initialMessage={pendingMessage}
        onConsumeInitialMessage={() => setPendingMessage("")}
        onNavigate={setPage}
        onOrder={handleOpenOrder}
      />

      <OrderPanel open={orderOpen} onClose={() => setOrderOpen(false)} />
    </div>
  );
}

export default function SiteApp() {
  return (
    <LangProvider>
      <AppShell />
    </LangProvider>
  );
}
