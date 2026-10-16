import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://rrcreativeinteriors.in";
const favicon = "/api/site-icon";
const socialImage = "/rr-media/hero/Interior%20Inspiration.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Fully Customised Interiors, Thoughtfully Priced | RR Creative Interiors",
  description:
    "Fully customised home, commercial and turnkey interiors in Bengaluru. Designed around your life and investment, with considered materials, clear scope and thoughtful execution.",
  keywords: [
    "interior designers in Bangalore",
    "interior design studio Bangalore",
    "home interiors Bangalore",
    "residential interior designers Bangalore",
    "turnkey interiors Bangalore",
    "commercial interior designers Bangalore",
    "corporate interiors Bangalore",
    "custom interior design Bangalore",
    "reasonably priced custom interiors Bangalore",
    "interior designers Bengaluru",
    "modular kitchen Bangalore",
    "custom furniture Bengaluru"
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
    title: "RR Creative Interiors — Made around you. Priced with purpose.",
    description:
      "Fully customised interiors in Bengaluru, planned around your lifestyle and investment.",
    url: siteUrl,
    siteName: "RR Creative Interiors",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: socialImage,
        alt: "RR Creative Interiors — interior design in Bangalore",
        width: 2000,
        height: 1333
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "RR Creative Interiors — Made around you. Priced with purpose.",
    description: "Fully customised interiors in Bengaluru. Clear scope, considered choices and thoughtful execution.",
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
      <body>{children}</body>
    </html>
  );
}
