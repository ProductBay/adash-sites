"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export function SafeImage(props: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  if (failedSource === props.src) return <span className="image-fallback" role="img" aria-label={props.alt ? `${props.alt} — image unavailable` : "Image unavailable"}>Image unavailable</span>;
  return <Image {...props} alt={props.alt} onError={() => setFailedSource(props.src)} />;
}
