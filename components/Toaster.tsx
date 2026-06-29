"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { subscribeToasts, type ToastItem } from "@/lib/toast";

const STYLES: Record<ToastItem["type"], { bar: string; ring: string; icon: string }> =
  {
    success: { bar: "bg-green-500", ring: "border-green-200", icon: "✅" },
    error: { bar: "bg-red-500", ring: "border-red-200", icon: "⚠️" },
    info: { bar: "bg-brand", ring: "border-brand/30", icon: "💜" },
  };

const DURATION = 4000;

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION);
  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const s = STYLES[item.type];

  function start() {
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onClose(item.id), remaining.current);
  }
  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pause() {
    setPaused(true);
    clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
  }
  function resume() {
    setPaused(false);
    start();
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      className={`pointer-events-auto relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-white shadow-lg ${s.ring}`}
    >
      <div className="flex items-start gap-2.5 p-3.5 pr-9 text-sm text-gray-800">
        <span aria-hidden>{s.icon}</span>
        <p className="flex-1">{item.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:text-gray-700"
      >
        ✕
      </button>
      <div
        className={`absolute bottom-0 left-0 h-1 ${s.bar}`}
        style={{
          animation: `toast-progress ${DURATION}ms linear forwards`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </motion.div>
  );
}

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts((item) =>
      setItems((prev) => [...prev, item].slice(-4))
    );
  }, []);

  function remove(id: number) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex flex-col items-end gap-2">
      <AnimatePresence>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onClose={remove} />
        ))}
      </AnimatePresence>
    </div>
  );
}
