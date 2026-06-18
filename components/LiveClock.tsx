"use client";

import { useEffect, useState } from "react";

function manilaTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const value = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${value("hour")}:${value("minute")}:${value("second")} PHT`;
}

export function LiveClock() {
  const [time, setTime] = useState("--:--:-- PHT");

  useEffect(() => {
    setTime(manilaTime());
    const interval = window.setInterval(() => setTime(manilaTime()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return <span suppressHydrationWarning>{time}</span>;
}
