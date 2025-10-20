// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";

import { Poppins, Geist, Geist_Mono } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
  adjustFontFallback: false, // <- para métricas más consistentes
  preload: true,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: true,
});

export const metadata: Metadata = {
  title: "CGCAI – Sistema de Auditoría Interna",
  description:
    "Este sistema ha sido elaborado íntegramente por el Centro de Gestión de la Calidad y Acreditación Institucional, con el objetivo de automatizar los procesos relacionados con las auditorías internas.",
};

// 👇 Viewport estable (evita autosizing en móviles)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      // 👇 todas las vars de fuentes en <html>
      className={`${poppins.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      {/* Usa font-family desde globals.css (var --font-poppins) */}
      <body className="antialiased">
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
