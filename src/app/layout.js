import { Syne, Manrope, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata = {
  title: "Clarity 3.0 - Financial Intelligence",
  description: "AI-powered analysis of Big Tech earnings calls, guidance, and strategic initiatives",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${syne.variable} ${manrope.variable} ${jetbrainsMono.variable} ${newsreader.variable} antialiased bg-background text-foreground font-sans selection:bg-accent selection:text-accent-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
