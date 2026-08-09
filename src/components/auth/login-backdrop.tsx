import { useEffect, useRef, useState } from "react";

/**
 * The visual half of the login screen.
 *
 * Renders a looping background video when one is available and falls back to
 * an animated gradient otherwise. The fallback is not a placeholder — it is
 * the default, and it is what most visitors see: it costs nothing to load and
 * cannot fail, whereas a video is several megabytes on a parent's phone.
 *
 * To use a real video, drop an MP4 at `public/brand/login.mp4` (and ideally a
 * poster frame at `public/brand/login-poster.jpg`) and set VIDEO_SRC below.
 * Nothing else needs to change: if the file is missing or the browser refuses
 * to play it, this component silently keeps the gradient.
 *
 * Keep any video short (8–15s), muted, and ideally under ~3 MB.
 */
const VIDEO_SRC: string | null = null; // e.g. "/brand/login.mp4"
const POSTER_SRC = "/brand/login-poster.jpg";

export function LoginBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !VIDEO_SRC) return;

    // Respect the OS "reduce motion" setting — an autoplaying loop is exactly
    // the kind of motion that setting exists to suppress.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // Autoplay is only allowed muted, and can still be refused; the promise
    // rejecting is normal, not an error worth surfacing.
    el.play()
      .then(() => setVideoOk(true))
      .catch(() => setVideoOk(false));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base wash, always painted, so nothing flashes white while a video
          buffers and the panel keeps its colour if the video never plays. */}
      <div className="absolute inset-0 bg-sidebar bg-mesh" />

      {VIDEO_SRC && (
        <video
          ref={videoRef}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${
            videoOk ? "opacity-40" : "opacity-0"
          }`}
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setVideoOk(false)}
        />
      )}

      {/* Animated colour fields. Three slow, offset drifts read as depth
          without the cost of a video; `blur-3xl` keeps them as soft light
          rather than visible shapes. */}
      <div className="absolute inset-0" aria-hidden="true">
        <span className="login-orb login-orb-1" />
        <span className="login-orb login-orb-2" />
        <span className="login-orb login-orb-3" />
      </div>

      {/* Faint grid: a subtle nod to a notebook page, and it gives the flat
          colour some texture at large sizes. */}
      <div className="login-grid absolute inset-0" aria-hidden="true" />

      {/* Bottom scrim so the copy and stats keep their contrast over whatever
          is behind them — solid colour, video, or moving gradient. */}
      <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/55 to-transparent" />
    </div>
  );
}
