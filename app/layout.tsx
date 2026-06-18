import type { Metadata } from "next";
import { Audiowide, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body"
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display"
});

const audiowide = Audiowide({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-brand"
});

export const metadata: Metadata = {
  title: "CBA Attendance Log",
  description: "A section-first QR attendance log for CBA classes."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${interTight.variable} ${audiowide.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
