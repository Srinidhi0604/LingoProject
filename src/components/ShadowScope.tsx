"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ShadowScopeProps = {
  stylesheets: string[];
  children: React.ReactNode;
};

export default function ShadowScope({ stylesheets, children }: ShadowScopeProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);

  const sheetKey = useMemo(() => stylesheets.join("\n"), [stylesheets]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });

    // Clear previous content.
    while (root.firstChild) root.removeChild(root.firstChild);

    const headStyle = document.createElement("style");
    headStyle.textContent = `:host{all:initial;display:block;contain:content}*{box-sizing:border-box}`;
    root.appendChild(headStyle);

    for (const href of stylesheets) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      root.appendChild(link);
    }

    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    root.appendChild(mount);
    setMountNode(mount);

    return () => {
      setMountNode(null);
    };
  }, [sheetKey, stylesheets]);

  return (
    <div ref={hostRef} style={{ width: "100%", height: "100%" }}>
      {mountNode ? createPortal(children, mountNode) : null}
    </div>
  );
}
