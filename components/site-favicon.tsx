
"use client";

import { useEffect } from "react";

export default function SiteFavicon() {
  useEffect(() => {
    let active = true;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'));
    const previous = links.map((link) => ({ link, href: link.href }));
    fetch("/api/site-assets", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || typeof data?.assets?.brandMark !== "string") return;
        links.forEach((link) => { link.href = data.assets.brandMark; });
      })
      .catch(() => {});
    return () => {
      active = false;
      previous.forEach(({ link, href }) => { link.href = href; });
    };
  }, []);
  return null;
}
