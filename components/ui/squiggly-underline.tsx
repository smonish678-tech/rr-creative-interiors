"use client";

import { motion } from "framer-motion";

export type SquigglyNavItem = {
  name: string;
  href: string;
};

type Props = {
  items: SquigglyNavItem[];
  active: string;
  onSelect: (name: string) => void;
};

export function SquigglyUnderline({ items, active, onSelect }: Props) {
  return (
    <div className="rr-squiggly-nav" role="navigation" aria-label="Primary navigation">
      {items.map((item) => {
        const selected = item.name === active;

        return (
          <a
            key={item.name}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            onClick={() => onSelect(item.name)}
            className={selected ? "rr-nav-link is-active" : "rr-nav-link"}
          >
            <span>{item.name}</span>
            {selected && (
              <motion.span
                layoutId="rr-squiggly"
                className="rr-squiggly"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden="true"
              >
                <svg width="42" height="9" viewBox="0 0 42 9" fill="none">
                  <motion.path
                    d="M1 6.4C6.9.7 7.1.8 9.2 6.7 9.4 7.3 12.6 3.3 14.1 2.7c2.4-1 4.3 1.4 6.9 1.2 3.1-.2 4.9-1.5 8-.2 3.2 1.2 6.4.2 11.9 1.1"
                    stroke="#D9B56F"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="96"
                    strokeDashoffset="96"
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </svg>
              </motion.span>
            )}
          </a>
        );
      })}
    </div>
  );
}
