"use client";
import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { installPageEdges } from "@/lib/page-edges";
export function PageEdges() {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (top.current && bottom.current) return installPageEdges(top.current, bottom.current);
  }, [pathname]);
  return (
    <>
      <div ref={top} className="edge-top" aria-hidden="true" />
      <div ref={bottom} className="edge-bottom" aria-hidden="true" />
    </>
  );
}
