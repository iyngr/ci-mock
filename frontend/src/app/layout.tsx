import type { Metadata } from "next";
import { Fraunces, Roboto_Flex } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Mock - Internal Technical Assessment Platform",
  description: "Employee portal for technical assessments and evaluations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${robotoFlex.variable} font-roboto-flex antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
