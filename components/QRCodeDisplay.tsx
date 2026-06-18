"use client";

import QRCode from "qrcode";
import { Copy, QrCode } from "lucide-react";
import { useEffect, useState } from "react";

export function QRCodeDisplay({ link }: { link: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(link, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0b1f3a",
        light: "#ffffff"
      }
    }).then((url) => {
      if (mounted) setDataUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [link]);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded border border-line bg-white p-5 shadow-soft">
      <div className="flex items-center justify-center rounded border border-line bg-white p-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Attendance QR code" className="h-72 w-72" />
        ) : (
          <QrCode className="text-graphite" size={64} />
        )}
      </div>
      <div className="mt-4 grid gap-3">
        <p className="break-all rounded border border-line bg-paper px-3 py-2 font-mono text-xs text-graphite">{link}</p>
        <button
          type="button"
          onClick={copyLink}
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ledger"
        >
          <Copy size={16} />
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
