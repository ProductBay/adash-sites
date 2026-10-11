"use client";

import Image from "next/image";
import { useState } from "react";

export function CatalogueProductImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="catalogue-image-fallback" role="img" aria-label={`${alt} image unavailable`}><span aria-hidden="true">✳</span><small>Image coming soon</small></div>;
  return <Image src={src} alt={alt} fill sizes="(max-width: 520px) 92vw, (max-width: 1024px) 46vw, 25vw" unoptimized={src.startsWith("/media/")} onError={() => setFailed(true)} />;
}
