import type { Metadata } from "next";
import "./globals.css";
import SiteFavicon from "@/components/site-favicon";

const siteUrl = "https://rrcreativeinteriors.in";
const favicon = "/rr-media/logo/Glossy%20Red%20and%20Gold%20Split%20Emblem.png";
const socialImage = "/rr-media/hero/Interior%20Inspiration.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Custom Interiors, Thoughtfully Priced | RR Creative Interiors",
  description:
    "Fully customised residential, commercial, renovation and turnkey interiors in Bengaluru—designed around your brief, with scope and budget considered from the start.",
  keywords: [
    "custom interior designers in Bengaluru",
    "custom interior design Bengaluru",
    "home interiors Bengaluru",
    "residential interiors Bengaluru",
    "turnkey interiors Bengaluru",
    "commercial interiors Bengaluru",
    "corporate interiors Bengaluru",
    "custom interiors thoughtfully priced",
    "modular kitchens Bengaluru"
  ],
  applicationName: "RR Creative Interiors",
  creator: "RR Creative Interiors",
  publisher: "RR Creative Interiors",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: favicon, type: "image/png" },
      { url: favicon, sizes: "192x192", type: "image/png" },
      { url: favicon, sizes: "512x512", type: "image/png" }
    ],
    apple: favicon
  },
  openGraph: {
    title: "Fully customised interiors, thoughtfully priced — RR Creative Interiors",
    description:
      "Custom residential, commercial, renovation and turnkey interiors in Bengaluru, planned around your brief and budget.",
    url: siteUrl,
    siteName: "RR Creative Interiors",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: socialImage,
        alt: "RR Creative Interiors — custom interiors in Bengaluru",
        width: 2000,
        height: 1333
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Fully customised interiors, thoughtfully priced — RR Creative Interiors",
    description: "Custom interiors in Bengaluru. Your taste, your needs, your budget.",
    images: [socialImage]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><SiteFavicon />{children}</body>
    </html>
  );
}
