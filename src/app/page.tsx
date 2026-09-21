"use client";

import React, { useState, useEffect } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#0B0F19] text-[#F9FAFB] overflow-hidden">
      {/* Seamlessly embeds the complete JobEaseAI Studio */}
      <iframe
        src="/index.html"
        title="JobEaseAI Studio"
        className="w-full h-full border-none flex-1"
      />
    </div>
  );
}
