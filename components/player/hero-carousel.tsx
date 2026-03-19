"use client";

import { useEffect, useRef, useState } from "react";
import type { Series } from "@/constants/mock-data";

interface HeroCarouselProps {
  items: Series[];
}

export function HeroCarousel({ items }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [items.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;
    const card = el.querySelector(`[data-index="${activeIndex}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex, items.length]);

  if (items.length === 0) return null;

  const goPrev = () => {
    setActiveIndex((i) => (i - 1 + items.length) % items.length);
  };

  const goNext = () => {
    setActiveIndex((i) => (i + 1) % items.length);
  };

  return (
    <section className="relative mb-6 pt-8 pb-8">
      <div
        className="flex items-center justify-center gap-4 overflow-x-visible scrollbar-thin snap-x snap-mandatory scroll-smooth md:gap-6"
        ref={scrollRef}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const scaleClass = isActive ? "scale-[1.3] z-20" : "scale-100 z-10";
          return (
            <div
              key={item.id}
              data-index={index}
              className={`relative w-[210px] shrink-0 snap-center md:w-[240px] transition-transform duration-300 ${scaleClass}`}
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-900 shadow-lg">
                <img
                  src={item.poster}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 左右切换箭头（桌面端显示） */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="pointer-events-auto absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 p-2 text-white ring-1 ring-zinc-700 hover:bg-black md:inline-flex"
            aria-label="Previous hero"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNext}
            className="pointer-events-auto absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 p-2 text-white ring-1 ring-zinc-700 hover:bg-black md:inline-flex"
            aria-label="Next hero"
          >
            ›
          </button>
        </>
      )}
      {/* 极简横条指示器 */}
      {items.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {items.slice(0, Math.min(items.length, 8)).map((_, i) => (
            <span
              key={i}
              className={`h-0.5 rounded-full transition-all ${
                i === activeIndex ? "w-8 bg-brand" : "w-3 bg-zinc-600"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
