import type { Metadata } from "next";
import { Geist_Mono, Outfit, Tektur } from "next/font/google";
import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { WalletProvider } from "@/components/Wallet";

import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const tektur = Tektur({ subsets: ["latin"], weight: ["600"], variable: "--font-tektur", display: "swap" });

export const metadata: Metadata = {
  title: "Keepalive: funding that stops when the work stops",
  description:
    "Recurring support for builders, released one period at a time only after GenLayer validators read the builder's report and links and agree the work is still happening.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable} ${tektur.variable}`}>
      <body>
        <WalletProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
