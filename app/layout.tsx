import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://rrcreativeinteriors.in";
const favicon = "/rr-media/logo/Glossy%20Red%20and%20Gold%20Split%20Emblem.png";
const socialImage = "/rr-media/hero/Interior%20Inspiration.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "RR Creative Interiors | Interior Designers in Bangalore",
  description:
    "RR Creative Interiors is a Bangalore interior design studio creating residential, commercial and turnkey spaces with thoughtful planning, refined materials and precise execution. Beyond The Ordinary.",
  keywords: [
    "interior designers in Bangalore",
    "interior design studio Bangalore",
    "home interiors Bangalore",
    "residential interior designers Bangalore",
    "turnkey interiors Bangalore",
    "commercial interior designers Bangalore",
    "corporate interiors Bangalore",
    "luxury interiors Bangalore",
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
    title: "RR Creative Interiors — Beyond The Ordinary",
    description:
      "Thoughtful residential, commercial and turnkey interiors in Bangalore.",
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
    title: "RR Creative Interiors — Beyond The Ordinary",
    description: "Interior design studio in Bangalore.",
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
