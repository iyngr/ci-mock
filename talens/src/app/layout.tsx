import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "AI Technical Assessment Platform",
  description: "Comprehensive technical assessment platform with AI-powered evaluation and real-time proctoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-system antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
