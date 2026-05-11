export type TopicSlug =
  | "co-to-jest"
  | "jak-zaczac"
  | "tworzenie-wydarzenia"
  | "platnosci"
  | "uczestnicy"
  | "promocja"
  | "cennik"
  | "faq";

export type IconId =
  | "info"
  | "rocket"
  | "calendar"
  | "wallet"
  | "users"
  | "share"
  | "tag"
  | "question";

export interface Topic {
  slug: TopicSlug;
  title: string;
  blurb: string;
  icon: IconId;
  related: TopicSlug[];
}

export const TOPICS: readonly Topic[] = [
  {
    slug: "co-to-jest",
    title: "Co to jest Wyjazdo i jak działa",
    blurb:
      "Krótko, prostym językiem: czym jest Wyjazdo, dla kogo i jak wygląda jeden wyjazd od strony organizatorki.",
    icon: "info",
    related: ["jak-zaczac", "tworzenie-wydarzenia", "cennik"],
  },
  {
    slug: "jak-zaczac",
    title: "Jak zacząć — konto i Twoja strona",
    blurb:
      "Załóż konto, wybierz adres swojej strony i przygotuj wszystko do pierwszego wydarzenia.",
    icon: "rocket",
    related: ["tworzenie-wydarzenia", "platnosci", "co-to-jest"],
  },
  {
    slug: "tworzenie-wydarzenia",
    title: "Tworzenie wydarzenia krok po kroku",
    blurb:
      "Dziesięć ekranów, jeden wyjazd. Co podać w każdym kroku i co możesz później zmienić.",
    icon: "calendar",
    related: ["uczestnicy", "platnosci", "promocja"],
  },
  {
    slug: "platnosci",
    title: "Płatności online i wypłaty",
    blurb:
      "BLIK, Przelewy24, karta. Jak działają zaliczki, kiedy pieniądze trafiają na Twoje konto i co robić, gdy operator prosi o dokumenty.",
    icon: "wallet",
    related: ["uczestnicy", "cennik", "tworzenie-wydarzenia"],
  },
  {
    slug: "uczestnicy",
    title: "Uczestniczki — lista, statusy, zapisy",
    blurb:
      "Jak czytać listę uczestniczek, co oznaczają statusy płatności, jak anulować zapis i wyeksportować dane.",
    icon: "users",
    related: ["platnosci", "tworzenie-wydarzenia", "faq"],
  },
  {
    slug: "promocja",
    title: "Promocja i udostępnianie wydarzenia",
    blurb:
      "Skąd wziąć link, jak działa Twoja subdomena i co zobaczą znajomi, gdy wkleisz adres na Facebooka lub Instagrama.",
    icon: "share",
    related: ["jak-zaczac", "tworzenie-wydarzenia", "uczestnicy"],
  },
  {
    slug: "cennik",
    title: "Ile kosztuje Wyjazdo — cennik i prowizje",
    blurb:
      "Wyjazdo dziś nie pobiera opłat za korzystanie. Wyjaśniamy, co dolicza operator płatności i kiedy może się to zmienić.",
    icon: "tag",
    related: ["platnosci", "co-to-jest", "faq"],
  },
  {
    slug: "faq",
    title: "Najczęstsze pytania (FAQ)",
    blurb:
      "Krótkie odpowiedzi na pytania, które dostajemy najczęściej — od bezpieczeństwa po anulowanie wyjazdu.",
    icon: "question",
    related: ["platnosci", "uczestnicy", "cennik"],
  },
] as const;

export function topicSlugs(): TopicSlug[] {
  return TOPICS.map((t) => t.slug);
}

export function getTopic(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

export function getRelatedTopics(slug: string): Topic[] {
  const topic = getTopic(slug);
  if (!topic) return [];
  return topic.related
    .map((s) => getTopic(s))
    .filter((t): t is Topic => t !== undefined);
}
