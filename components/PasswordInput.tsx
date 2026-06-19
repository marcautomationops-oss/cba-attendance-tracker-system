"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide access code" : "Show access code";

  return (
    <span className="relative block min-w-0">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} w-full pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="focus-ring absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-graphite transition hover:text-ink"
        aria-label={label}
        title={label}
      >
        {visible ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </span>
  );
}
