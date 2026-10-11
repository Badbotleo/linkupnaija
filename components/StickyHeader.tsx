"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The mobile header, which gets out of the way while you are browsing.
 *
 * WHY. The top bar costs 65px of a phone screen and holds two things: the
 * logo and the hamburger. Neither is wanted while somebody is scrolling a
 * feed, and both are wanted the moment they stop. Hiding it on the way down
 * and returning it on the way up gives the content the full screen without
 * anybody losing their way back to navigation.
 *
 * It is a client component only because scroll direction is. Navbar stays a
 * server component and passes its markup straight through, so nothing about
 * the session, the unread count or the admin check moves to the browser.
 *
 * THREE THINGS THAT MAKE IT FEEL RIGHT RATHER THAN TWITCHY:
 *
 * The top of the page always shows it. Below 80px there is no hiding at all,
 * so the first thing anybody sees on landing is the brand, and a short page
 * can never leave the header stranded off-screen.
 *
 * Small movements are ignored. A six pixel threshold stops the bar flickering
 * on the wobble of a thumb that has not decided which way it is going.
 *
 * It respects prefers-reduced-motion. Somebody who has asked the system to
 * stop animating things gets the bar appearing and disappearing without the
 * slide, rather than the slide at full speed.
 */
export default function StickyHeader({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    last.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;

      // Near the top the header is always present. This also covers the
      // rubber-band overscroll on iOS, where y goes negative and a naive
      // direction check reads it as scrolling up and then down again.
      if (y < 80) {
        setHidden(false);
        last.current = y;
        return;
      }

      const dy = y - last.current;
      if (Math.abs(dy) < 6) return;
      setHidden(dy > 0);
      last.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`${className} transition-transform duration-200 motion-reduce:transition-none ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {children}
    </header>
  );
}
