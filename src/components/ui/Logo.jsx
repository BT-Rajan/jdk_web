import { useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import "./Logo.css";

/**
 * Logo image URL and wordmark text both come from live branding config
 * (branding.logoUrl / branding.siteName — see useLang()), so swapping
 * either from the admin panel needs no rebuild. The wordmark is always
 * shown — it's what makes the mark legible at header size — next to
 * the image when there is one, or alone if there's no logo configured
 * or the image fails to load.
 */
export default function Logo() {
  const { branding } = useLang();
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = branding.logoUrl && !imgFailed;

  return (
    <div className="logo">
      {showImage && (
        <img
          className="logo-img"
          style={{
            "--logo-scale": branding.logoScale || 1,
            "--logo-glow": branding.logoGlow ?? 0.5,
            "--logo-glow-color": branding.logoGlowColor || "#c9a84c",
          }}
          src={branding.logoUrl}
          alt={`${branding.siteName} logo`}
          onError={() => setImgFailed(true)}
        />
      )}
      <span className="logo-word">{branding.siteName}</span>
    </div>
  );
}
