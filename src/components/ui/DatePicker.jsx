import { useEffect, useRef, useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import "./DatePicker.css";

const WEEKDAYS = { en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], ar: ["ن", "ث", "ر", "خ", "ج", "س", "ح"] };
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ISO "YYYY-MM-DD" <-> "DD/MM/YYYY" — every calendar on the site shows
// the latter (see OrderPanel.jsx's "Required by" field), while every
// other piece of code (validation, min/max comparison, the backend)
// keeps working against plain ISO strings, so this component is the
// only place that ever deals with the display format.
function isoToDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// Real-calendar-date check (rejects e.g. 31/02/2026) — round-trips
// through Date and compares the parts back, same technique OrderPanel
// already uses for its own isRealDate.
function displayToIso(display) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// Digit-only auto-formatter: strips anything non-numeric and re-inserts
// the two slashes as the admin types, so backspacing/pasting can't
// leave the field in a half-slashed state.
function autoFormat(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function startOfMonth(y, m) {
  return new Date(y, m, 1);
}

// Monday-first 6x7 grid covering the given month, including the
// trailing/leading days of the neighboring months so every week row is
// full — same layout every consumer-facing calendar widget uses.
function buildGrid(y, m) {
  const first = startOfMonth(y, m);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(y, m, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isoOf(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * DD/MM/YYYY text field + calendar popover, validated against `min`
 * (an ISO "YYYY-MM-DD" string, same as this component's own `value`
 * and what it hands back to `onChange`). A day outside `min` can't be
 * picked from the calendar and never parses as valid from typed text,
 * so the caller's own validation (e.g. OrderPanel's isRealDate/min
 * checks) always sees either a real, in-range ISO date or "".
 */
export default function DatePicker({ id, value, onChange, onBlur, min, required, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy }) {
  const { lang, dir } = useLang();
  const weekdays = WEEKDAYS[lang] || WEEKDAYS.en;
  const months = MONTHS[lang] || MONTHS.en;

  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const minDate = min ? new Date(`${min}T00:00:00`) : null;
  const initial = value ? new Date(`${value}T00:00:00`) : minDate || new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const rootRef = useRef(null);

  // Reflects an external value change (calendar pick, form reset,
  // rollback, ...) into the visible text — never the other way while
  // the admin is actively typing (see handleTextChange).
  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // A React (not document-level) handler, so it fires — and can stop
  // propagation — before Escape reaches an ancestor's own key handler,
  // e.g. OrderPanel's "Escape closes the whole form" on its root panel.
  // Without stopPropagation, closing just this popover would also
  // close the form behind it.
  function handleKeyDown(e) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  function handleTextChange(e) {
    const formatted = autoFormat(e.target.value);
    setText(formatted);
    const iso = displayToIso(formatted);
    if (iso && (!min || iso >= min)) {
      onChange(iso);
      const d = new Date(`${iso}T00:00:00`);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } else {
      onChange("");
    }
  }

  function pick(d) {
    const iso = isoOf(d);
    onChange(iso);
    setText(isoToDisplay(iso));
    setOpen(false);
  }

  function changeMonth(delta) {
    let y = viewYear, m = viewMonth + delta;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  }

  const grid = buildGrid(viewYear, viewMonth);
  const selectedIso = value || null;
  const todayIso = isoOf(new Date());

  return (
    <div className="date-picker" ref={rootRef} onKeyDown={handleKeyDown}>
      <div className="date-picker-input-row">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          value={text}
          onChange={handleTextChange}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          required={required}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoComplete="off"
        />
        <button
          type="button"
          className="date-picker-toggle"
          aria-label="Open calendar"
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="date-picker-popover" dir={dir}>
          <div className="date-picker-nav">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
            <span>{months[viewMonth]} {viewYear}</span>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="date-picker-weekdays">
            {weekdays.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="date-picker-grid">
            {grid.map((d) => {
              const iso = isoOf(d);
              const inMonth = d.getMonth() === viewMonth;
              const disabled = min ? iso < min : false;
              return (
                <button
                  key={iso}
                  type="button"
                  className={[
                    "date-picker-day",
                    inMonth ? "" : "date-picker-day-outside",
                    iso === selectedIso ? "date-picker-day-selected" : "",
                    iso === todayIso ? "date-picker-day-today" : "",
                  ].join(" ").trim()}
                  disabled={disabled}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
