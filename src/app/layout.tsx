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
  title: "Ana & Pedro — Álbum de Fotos ao Vivo",
  description: "Álbum de fotos virtual do casamento de Ana & Pedro. Envie e compartilhe seus melhores momentos!",
  keywords: ["casamento", "álbum de fotos", "Ana & Pedro", "casamento digital"],
  authors: [{ name: "Ana & Pedro" }],
  openGraph: {
    title: "Ana & Pedro — Álbum de Fotos ao Vivo",
    description: "Compartilhe seus melhores momentos do casamento!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ana & Pedro — Álbum de Fotos ao Vivo",
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
