import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Relay — messaging that keeps up",
  description:
    "A real-time chat client for direct and group conversations: live delivery, resilient reconnects, and history that never loses its place.",
  openGraph: {
    title: "Relay — messaging that keeps up",
    description:
      "Real-time direct and group chat with live delivery and resilient reconnects.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#14131c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
