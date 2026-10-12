"use client";
import { useEffect, useRef, useState } from "react";

export function PoweredByAdashBadge() {
  const anchor = useRef<HTMLAnchorElement>(null);
  const [obstructed, setObstructed] = useState(false);
  useEffect(() => {
    let frame = 0;
    function measure() {
      frame = 0;
      const badge = anchor.current;
      if (!badge) return;
      const box = badge.getBoundingClientRect();
      const collision = [...document.querySelectorAll<HTMLElement>("main a, main button, main input, main select, main textarea, main p, main h1, main h2, main h3, main img, [data-floating-control]")].some(control => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
      });
      // Keep customer actions available; keep a focused badge stable for keyboard users.
      setObstructed(collision && document.activeElement !== badge);
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    schedule();
    return () => { observer.disconnect(); document.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, []);
  return <div className="powered-by-adash-space"><a ref={anchor} className="powered-by-adash-badge" data-obstructed={obstructed || undefined} data-analytics-event="powered_by_adash_clicked" href="https://adash.technology/sites" target="_blank" rel="noopener noreferrer" aria-label="Powered by A’Dash. Get your business website today (opens in a new tab)">
    <span className="powered-by-adash-mark" aria-hidden="true">A’DASH</span>
    <span className="powered-by-adash-copy"><strong>Powered by A’Dash</strong><span>Get your business website today</span></span>
    <span className="powered-by-adash-arrow" aria-hidden="true">↗</span>
  </a></div>;
}
