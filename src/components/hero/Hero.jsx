import { useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import { COPY, HOME_TOPICS } from "../../data/content.js";
import TopBar from "../layout/TopBar.jsx";
import ClassicLayout from "./layouts/ClassicLayout.jsx";
import SplitLayout from "./layouts/SplitLayout.jsx";
import CenteredCardLayout from "./layouts/CenteredCardLayout.jsx";
import EditorialLayout from "./layouts/EditorialLayout.jsx";
import HomeShowcase from "../showcase/HomeShowcase.jsx";
import "./Hero.css";

// Keyed by theme.layoutTemplate (see backend/app/settings_registry.py).
// "classic" is both the map's fallback and the default admin value, so
// an unset or unrecognized template can never fail to render — it
// just renders the site's original layout. Every layout receives the
// exact same props/data and calls the exact same onNavigate/onEnter
// handlers — only the arrangement of headline, tagline, quick-chat
// box, and nav cards differs between them. None of them touch chat or
// voice functionality, which all live in ChatWidget.
const LAYOUTS = {
  classic: ClassicLayout,
  split: SplitLayout,
  "centered-card": CenteredCardLayout,
  editorial: EditorialLayout,
};

/**
 * Landing page. Entry into the chat assistant is either straight from
 * the quick-start chat box (which hands the typed message off to the
 * sticky AI Assistant widget — see onEnter/App.jsx) or via the
 * always-visible sticky button itself. Which arrangement the headline/
 * tagline/quick-chat/nav-cards render in is chosen by the admin (see
 * Settings > Theme > Homepage layout) — see LAYOUTS above.
 */
// The new hero-hierarchy fields (heroStatement/taglineLine1/taglineLine2/
// supportingText/examplePrompts) live inside the same free-form
// copy.home JSON blob as the rest of the homepage text, so an admin
// who hasn't touched Settings > On-screen text yet simply won't have
// them in the live backend response. Falling back per-field (not
// per-object) to the bundled copy means a partially-configured
// copy.home still renders the full hierarchy instead of blank gaps.
function withHomeFallbacks(home, lang) {
  const fallback = COPY[lang]?.home ?? COPY.en.home;
  return {
    ...home,
    heroStatement: home.heroStatement ?? fallback.heroStatement,
    taglineLine1: home.taglineLine1 ?? fallback.taglineLine1,
    taglineLine2: home.taglineLine2 ?? fallback.taglineLine2,
    supportingText: home.supportingText ?? fallback.supportingText,
    examplePrompts: home.examplePrompts ?? fallback.examplePrompts,
  };
}

export default function Hero({ onEnter, onNavigate }) {
  const { copy, sections, nav, branding, heroButtons, lang, theme } = useLang();
  const [quickDraft, setQuickDraft] = useState("");
  const home = withHomeFallbacks(copy.home, lang);

  function handleQuickSend() {
    const text = quickDraft.trim();
    if (!text) return;
    setQuickDraft("");
    onEnter(text);
  }

  // Same direct handoff to the AI Assistant as the topic buttons below
  // — an example prompt is a suggestion, not text the visitor typed,
  // so it skips the quick-chat draft state entirely.
  function handleExamplePick(prompt) {
    onEnter(prompt);
  }

  // The 4 homepage topic buttons (Software Development / Artificial
  // Intelligence / Digital Transformation / Consulting) aren't page
  // links — clicking one hands its preset question straight to the
  // AI Assistant, the same handoff the quick-chat box uses above.
  const homeTopics = HOME_TOPICS[lang] || HOME_TOPICS.en;
  function handleTopicClick(topicId) {
    const topic = homeTopics.find((t) => t.id === topicId);
    if (topic) onEnter(topic.question);
  }

  const Layout = LAYOUTS[theme?.layoutTemplate] || ClassicLayout;

  return (
    <div className="hero-page">
      <TopBar onNavigate={onNavigate} />

      {/* Two-column band: the admin's photo showcase paired beside
          whichever layout template is active (its headline/quick-chat/
          nav content, unchanged). The showcase is the first child so it
          takes the *start* side of the row — the left in English (LTR)
          and, since the page flips dir="rtl" for Arabic (see
          LangContext), the right in Arabic — with the chat/nav content
          on the other side. HomeShowcase renders nothing until there's
          at least one active photo, so with no photos this collapses
          back to exactly the single-column layout it always was —
          .hero-body-row's flex sizing does that on its own, nothing
          here needs to special-case an empty showcase. Stacks to a
          single column below the tablet breakpoint (see Hero.css) so it
          never competes for room with the quick-chat composer on a
          phone. */}
      <div className="hero-body-row">
        <HomeShowcase />

        <div className="hero-body-main">
          <Layout
            copy={copy}
            home={home}
            sections={sections}
            nav={nav}
            heroButtons={heroButtons}
            lang={lang}
            onNavigate={onNavigate}
            quickDraft={quickDraft}
            setQuickDraft={setQuickDraft}
            onQuickSend={handleQuickSend}
            onExamplePick={handleExamplePick}
            headlineStyle={theme?.headlineStyle}
            headlineTypingSpeedCps={theme?.headlineTypingSpeedCps}
            branding={branding}
            homeTopics={homeTopics}
            onTopicClick={handleTopicClick}
          />
        </div>
      </div>
    </div>
  );
}
