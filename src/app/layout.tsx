import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "wyjazdo.pl",
  description: "Platforma dla organizatorów wyjazdów i wydarzeń",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: "light",
        variables: {
          colorPrimary: "#1E3A5F",
          colorText: "#111827",
          colorTextSecondary: "#6B7280",
          colorInputBackground: "#FAFAFA",
          colorBackground: "#FAFAFA",
        },
      }}
    >
      <html lang="pl" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        <body className="min-h-screen bg-background font-sans text-foreground antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
