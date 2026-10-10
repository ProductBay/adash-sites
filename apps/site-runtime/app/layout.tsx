import type { ReactNode } from "react";
import "./style.css";
import { PwaRegistration } from "./pwa-registration";
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><head><link rel="manifest" href="/manifest.webmanifest" /></head><body>{children}<PwaRegistration /></body></html>; }
