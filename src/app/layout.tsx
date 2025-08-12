import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider"; // 👈

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CGCAI – Sistema de Auditoría Interna",
  description:
    "Este sistema ha sido elaborado íntegramente por el Centro de Gestión de la Calidad y Acreditación Institucional, con el objetivo de automatizar los procesos relacionados con las auditorías internas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <ToastProvider /> {/* 👈 ahora el contenedor está en cliente */}
      </body>
    </html>
  );
}
