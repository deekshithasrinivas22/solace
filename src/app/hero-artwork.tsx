"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Flower2 } from "lucide-react";

export function HeroArtwork() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="hero-art" aria-label="A sample memory arranged like a scrapbook page">
      <div className="art-sun" />
      <motion.div
        className="photo-card"
        initial={reduceMotion ? false : { opacity: 0, y: 22, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -7 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
      >
        <span className="tape" aria-hidden="true" />
        <svg className="photo-art" viewBox="0 0 320 350" role="img" aria-label="A quiet illustrated hillside at sunset">
          <defs>
            <linearGradient id="evening-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c8c8b6" />
              <stop offset="1" stopColor="#e6c7a7" />
            </linearGradient>
            <linearGradient id="evening-hill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#788064" />
              <stop offset="1" stopColor="#515c4b" />
            </linearGradient>
          </defs>
          <rect width="320" height="350" fill="url(#evening-sky)" />
          <circle cx="222" cy="111" r="38" fill="#d9956e" opacity=".82" />
          <path d="M0 220 80 155l63 60 76-95 101 99v131H0Z" fill="#9b9a7d" />
          <path d="M0 257c51-42 102-43 148-8 43-45 106-51 172-13v114H0Z" fill="url(#evening-hill)" />
          <path d="M0 292c70-23 123-18 171 13 48-30 99-31 149-4v49H0Z" fill="#687052" />
          <path d="M66 350c13-50 21-86 43-103 24 17 35 53 41 103" fill="#443f37" />
          <path d="M104 262c-28-4-39-20-31-41 23 1 37 13 39 35 4-26 18-39 42-38 2 22-11 40-39 48" fill="#6f775a" />
          <path d="M238 350c-8-35-8-61 7-79 14 18 18 44 12 79" fill="#4b493d" />
          <path d="M245 281c-21-8-28-21-21-38 17 3 25 13 25 31 7-18 18-24 35-19-2 17-13 28-32 32" fill="#7f8461" />
          <path d="M29 179c14-3 24-1 32 6M51 189c12-3 20-1 28 4" fill="none" stroke="#f7ede0" strokeLinecap="round" strokeWidth="3" opacity=".65" />
        </svg>
        <figcaption>a day worth keeping</figcaption>
      </motion.div>
      <motion.div
        className="photo-date"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.86, rotate: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 9 }}
        transition={{ duration: 0.6, delay: 0.18, ease: "easeOut" }}
      >
        <strong>Sept. 14</strong>
        <span>somewhere slow</span>
      </motion.div>
      <motion.div
        className="note-card"
        initial={reduceMotion ? false : { opacity: 0, y: 14, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: 5 }}
        transition={{ duration: 0.65, delay: 0.28, ease: "easeOut" }}
      >
        <span>little note to self</span>
        <strong>We took the long way home.</strong>
      </motion.div>
      <Flower2 className="art-flower" size={54} strokeWidth={0.8} aria-hidden="true" />
    </div>
  );
}
