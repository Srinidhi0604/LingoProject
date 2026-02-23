import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LingoProvider } from "@lingo.dev/compiler/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voxera — Voice-Powered IDE with Lingo.dev",
  description:
    "Build React apps with voice commands, visual drag-and-drop, and real-time multilingual translations powered by Lingo.dev.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LingoProvider showWidget={false}>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
        </body>
      </html>
    </LingoProvider>
  );
}
