import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Patrícia & Samuel — Álbum de Fotos",
  description: "Álbum de fotos virtual do casamento de Patrícia & Samuel. Envie e compartilhe seus melhores momentos!",
  keywords: ["casamento", "álbum de fotos", "Patrícia & Samuel", "casamento digital"],
  authors: [{ name: "Patrícia & Samuel" }],
  openGraph: {
    title: "Patrícia & Samuel — Álbum de Fotos",
    description: "Compartilhe seus melhores momentos do casamento!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Patrícia & Samuel — Álbum de Fotos",
    description: "Compartilhe seus melhores momentos do casamento!",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
