import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://rrcreativeinteriors.in";
const favicon = "/api/site-assets/logo";
const socialImage = "/rr-media/hero/Interior%20Inspiration.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Custom Interior Designers in Bengaluru | RR Creative Interiors",
  description:
    "Fully customised residential, commercial and turnkey interiors in Bengaluru. Personal design, considered material choices and pricing shaped around your brief.",
  keywords: [
    "interior designers in Bangalore",
    "interior design studio Bangalore",
    "home interiors Bangalore",
    "residential interior designers Bangalore",
    "turnkey interiors Bangalore",
    "commercial interior designers Bangalore",
    "corporate interiors Bangalore",
    "custom interior design Bangalore",
    "affordable custom interiors Bengaluru",
    "modular kitchen Bangalore"
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
    title: "Fully customised interiors. Thoughtfully priced. | RR Creative Interiors",
    description:
      "Personalised home and commercial interiors in Bengaluru, designed around your brief and a budget that makes sense.",
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
    title: "Fully customised interiors. Thoughtfully priced. | RR Creative Interiors",
    description: "Personalised residential and commercial interiors in Bengaluru, with a clear brief and considered choices.",
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
