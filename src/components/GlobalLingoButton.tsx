"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export default function GlobalLingoButton() {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push("/lingo-dev");
  }, [router]);

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-base shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105 transition-all duration-200 cursor-pointer"
      aria-label="Lingo Dev"
    >
      लिंगो देव
    </button>
  );
}
