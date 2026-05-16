import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Playfair_Display } from "next/font/google";
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

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Patrícia & Samuel — Álbum de Casamento",
  description: "Álbum de fotos virtual do casamento de Patrícia & Samuel. Envie suas fotos e deixe mensagens para os noivos!",
  keywords: ["casamento", "álbum de fotos", "Patrícia & Samuel", "casamento digital"],
  authors: [{ name: "Patrícia & Samuel" }],
  openGraph: {
    title: "Patrícia & Samuel — Álbum de Casamento",
    description: "Compartilhe seus melhores momentos do casamento de Patrícia & Samuel!",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Patrícia & Samuel — Álbum de Casamento",
    description: "Compartilhe seus melhores momentos do casamento de Patrícia & Samuel!",
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
        className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${playfair.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
