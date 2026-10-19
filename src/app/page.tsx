import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { ContactSection } from "@/components/landing/ContactSection";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ParticipantList } from "@/components/landing/ParticipantList";
import { Pricing } from "@/components/landing/Pricing";
import { SignupFlow } from "@/components/landing/SignupFlow";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { siteOrigin } from "@/lib/urls";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Wyjazdo",
  alternateName: "wyjazdo.pl",
  url: siteOrigin(),
  description:
    "Zapisy i wpłaty na wyjazdy, retreaty i warsztaty w jednym linku: strona wyjazdu, zaliczki i dopłaty BLIK-iem, automatyczne przypomnienia i lista uczestniczek.",
  inLanguage: "pl-PL",
  publisher: {
    "@type": "Organization",
    name: "Wyjazdo",
    url: siteOrigin(),
    logo: `${siteOrigin()}/logo.png`,
  },
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-oat font-body text-lg leading-[1.6] text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <BeforeAfter />
        <SignupFlow />
        <ParticipantList />
        <Pricing />
        <Faq />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  );
}
