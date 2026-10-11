"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useRef } from "react";
import { help, helpExtras, type HelpKey } from "./help";

export function AdminHelpDrawer() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const segment = pathname.split("/")[2];
  const section: HelpKey = segment && segment in help ? segment as HelpKey : "overview";
  const item = help[section];
  return <><button type="button" className="help-launcher" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">Need help?</button><dialog ref={dialog} className="help-dialog" aria-labelledby="help-dialog-title"><div className="help-dialog-head"><p className="eyebrow">A’Dash Sites guide</p><button type="button" className="secondary" onClick={() => dialog.current?.close()} aria-label="Close help">Close</button></div><h2 id="help-dialog-title">{item.title}</h2><p>{item.purpose}</p><p><strong>What you should add:</strong> {helpExtras[section].need}</p><p><strong>What to do next:</strong> {item.next}</p><ul>{item.tips.map(tip => <li key={tip}>{tip}</li>)}</ul><p><strong>Common mistake:</strong> {helpExtras[section].mistake}</p><Link href={item.href} onClick={() => dialog.current?.close()}>{item.action} →</Link></dialog></>;
}
