"use client";
import { useEffect } from "react";
export function PwaRegistration() { useEffect(() => { if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname.endsWith(".localhost"))) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []); return null; }
