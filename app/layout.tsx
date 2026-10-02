import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RR Creative Interiors | Interior Designers in Bangalore",
  description:
    "RR Creative Interiors — thoughtful residential, commercial and turnkey interior design in Bangalore. Beyond The Ordinary.",
  keywords: [
    "interior designers in Bangalore",
    "best interior designers in Bangalore",
    "luxury interiors Bangalore",
    "home interiors Bangalore",
    "turnkey interiors Bangalore",
    "modular kitchen Bangalore",
    "residential interior designers Bangalore",
    "commercial interior designers Bangalore"
  ],
  metadataBase: new URL("https://rrcreativeinteriors.in"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "RR Creative Interiors — Beyond The Ordinary",
    description:
      "Thoughtful interiors shaped around the way you live, work and feel.",
    url: "https://rrcreativeinteriors.in",
    siteName: "RR Creative Interiors",
    type: "website",
    images: [
      {
        url: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2000&q=85",
        width: 2000,
        height: 1333,
        alt: "Luxury contemporary interior"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "RR Creative Interiors — Beyond The Ordinary",
    description: "Interior designers in Bangalore."
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}