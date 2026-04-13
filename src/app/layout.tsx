import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/lib/registry";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plenish — AI Meal Planner",
  description: "Your AI-powered meal tracking and planning assistant. Log meals, discover culturally-relevant recipes, and plan your week with Plenish.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <StyledComponentsRegistry>
          {children}
          {/* Mobile bottom tab nav — hidden on ≥ 768px via its own media query */}
          <MobileBottomNav />
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
