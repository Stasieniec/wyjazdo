// src/lib/legal/seed-documents.ts
import { getLatestDocument, insertLegalDocument } from "@/lib/db/queries/legal";

const INITIAL_DOCUMENTS = [
  {
    type: "regulamin" as const,
    title: "Regulamin serwisu wyjazdo.pl",
    content: `# Regulamin serwisu wyjazdo.pl

## 1. Postanowienia ogólne

1.1. Niniejszy regulamin (dalej: "Regulamin") określa zasady korzystania z serwisu internetowego wyjazdo.pl (dalej: "Serwis"), prowadzonego przez [NAZWA FIRMY], z siedzibą w [ADRES], NIP: [NIP], REGON: [REGON] (dalej: "Usługodawca").

1.2. Serwis umożliwia organizatorom wyjazdów, retreatów i warsztatów (dalej: "Organizatorzy") tworzenie stron wydarzeń z formularzami zapisu oraz obsługę płatności online, a uczestnikom (dalej: "Uczestnicy") zapisywanie się na wydarzenia i dokonywanie płatności.

1.3. Korzystanie z Serwisu wymaga akceptacji niniejszego Regulaminu.

## 2. Definicje

- **Serwis** -- platforma internetowa dostępna pod adresem wyjazdo.pl oraz subdomenami.
- **Organizator** -- osoba fizyczna prowadząca działalność gospodarczą, osoba prawna lub jednostka organizacyjna korzystająca z Serwisu w celu organizacji wydarzeń.
- **Uczestnik** -- osoba fizyczna zapisująca się na wydarzenie za pośrednictwem Serwisu.
- **Wydarzenie** -- wyjazd, retreat, warsztat lub inne wydarzenie organizowane przez Organizatora.

## 3. Zasady korzystania z Serwisu

3.1. Serwis świadczy usługi drogą elektroniczną w rozumieniu ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.

3.2. Wymagania techniczne: przeglądarka internetowa z obsługą JavaScript, dostęp do internetu.

3.3. Zabrania się dostarczania treści o charakterze bezprawnym.

## 4. Umowa między Organizatorem a Uczestnikiem

4.1. Serwis pełni rolę pośrednika technicznego. Umowa dotycząca udziału w wydarzeniu zawierana jest bezpośrednio między Organizatorem a Uczestnikiem.

4.2. Usługodawca nie jest stroną umowy o udział w wydarzeniu i nie ponosi odpowiedzialności za wykonanie zobowiązań Organizatora wobec Uczestnika.

## 5. Płatności

5.1. Płatności realizowane są za pośrednictwem operatora Stripe. Uczestnik dokonuje płatności na rachunek Organizatora prowadzony przez Stripe.

5.2. Usługodawca nie przechowuje danych kart płatniczych.

## 6. Prawo odstąpienia

6.1. Zgodnie z art. 38 pkt 12 ustawy z dnia 30 maja 2014 r. o prawach konsumenta, prawo odstąpienia od umowy nie przysługuje w odniesieniu do umów o świadczenie usług związanych z wydarzeniami rozrywkowymi, sportowymi lub kulturalnymi, jeżeli w umowie oznaczono dzień lub okres świadczenia usługi.

6.2. Zasady rezygnacji z udziału w wydarzeniu określa Organizator w regulaminie wydarzenia.

## 7. Reklamacje

7.1. Reklamacje dotyczące działania Serwisu należy składać na adres: [EMAIL].

7.2. Usługodawca rozpatruje reklamacje w terminie 14 dni od ich otrzymania.

## 8. Postanowienia końcowe

8.1. Usługodawca zastrzega sobie prawo do zmiany Regulaminu. O zmianach użytkownicy zostaną poinformowani z 14-dniowym wyprzedzeniem.

8.2. W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają przepisy prawa polskiego.

8.3. Link do platformy ODR: https://ec.europa.eu/consumers/odr/

Data wejścia w życie: [DATA]`,
  },
  {
    type: "privacy_policy" as const,
    title: "Polityka prywatności wyjazdo.pl",
    content: `# Polityka prywatności wyjazdo.pl

## 1. Administrator danych

Administratorem Twoich danych osobowych jest [NAZWA FIRMY], z siedzibą w [ADRES], NIP: [NIP] (dalej: "Administrator").

Kontakt: [EMAIL]

## 2. Cele i podstawy przetwarzania

Przetwarzamy Twoje dane w następujących celach:

| Cel | Podstawa prawna | Okres przechowywania |
|-----|----------------|---------------------|
| Świadczenie usług Serwisu (konto, zapisy na wydarzenia) | Art. 6 ust. 1 lit. b RODO -- wykonanie umowy | Czas trwania umowy + 3 lata |
| Obsługa płatności | Art. 6 ust. 1 lit. b RODO -- wykonanie umowy | Czas trwania umowy + okres przedawnienia |
| Rozliczenia podatkowe | Art. 6 ust. 1 lit. c RODO -- obowiązek prawny | 5 lat od końca roku podatkowego |
| Dochodzenie roszczeń | Art. 6 ust. 1 lit. f RODO -- uzasadniony interes | Do przedawnienia roszczeń |
| Marketing bezpośredni (za zgodą) | Art. 6 ust. 1 lit. a RODO -- zgoda | Do wycofania zgody |

## 3. Odbiorcy danych

Twoje dane mogą być przekazywane:
- Stripe (obsługa płatności)
- Cloudflare (hosting)
- Resend (wysyłka e-mail)
- Clerk (autentykacja organizatorów)
- Organizatorom wydarzeń, na które się zapisujesz

## 4. Transfer danych poza EOG

Niektórzy z naszych podwykonawców (Stripe, Cloudflare, Clerk) mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym, na podstawie standardowych klauzul umownych (SCC) lub decyzji o adekwatności.

## 5. Twoje prawa

Przysługuje Ci prawo do:
- dostępu do danych (art. 15 RODO)
- sprostowania danych (art. 16 RODO)
- usunięcia danych (art. 17 RODO)
- ograniczenia przetwarzania (art. 18 RODO)
- przenoszenia danych (art. 20 RODO)
- sprzeciwu (art. 21 RODO)
- wycofania zgody w dowolnym momencie (art. 7 ust. 3 RODO)
- wniesienia skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa)

## 6. Informacja o wymogu podania danych

Podanie danych jest dobrowolne, ale niezbędne do korzystania z Serwisu. Bez podania danych oznaczonych jako wymagane nie jest możliwe zapisanie się na wydarzenie.

## 7. Profilowanie

Serwis nie podejmuje zautomatyzowanych decyzji, w tym profilowania, o którym mowa w art. 22 ust. 1 i 4 RODO.

Data wejścia w życie: [DATA]`,
  },
  {
    type: "dpa" as const,
    title: "Umowa powierzenia przetwarzania danych osobowych",
    content: `# Umowa powierzenia przetwarzania danych osobowych

zawarta pomiędzy:

**Administratorem** -- Organizatorem korzystającym z Serwisu wyjazdo.pl (dalej: "Administrator")

a

**Podmiotem przetwarzającym** -- [NAZWA FIRMY], z siedzibą w [ADRES], NIP: [NIP] (dalej: "Procesor"), operatorem Serwisu wyjazdo.pl.

## 1. Przedmiot umowy

1.1. Administrator powierza Procesorowi przetwarzanie danych osobowych uczestników wydarzeń organizowanych za pośrednictwem Serwisu, na zasadach określonych w art. 28 RODO.

## 2. Zakres powierzenia

- **Kategorie osób:** uczestnicy wydarzeń Administratora
- **Rodzaje danych:** imię, nazwisko, adres e-mail, numer telefonu, odpowiedzi na pytania niestandardowe, dane o płatnościach
- **Charakter przetwarzania:** zbieranie, przechowywanie, udostępnianie Administratorowi
- **Cel przetwarzania:** umożliwienie rejestracji na wydarzenia i obsługi płatności
- **Czas trwania:** okres korzystania z Serwisu przez Administratora

## 3. Obowiązki Procesora

Procesor zobowiązuje się do:
- przetwarzania danych wyłącznie na udokumentowane polecenie Administratora
- zapewnienia, że osoby upoważnione do przetwarzania zobowiązały się do zachowania poufności
- wdrożenia odpowiednich środków technicznych i organizacyjnych (szyfrowanie, kontrola dostępu)
- przestrzegania warunków korzystania z usług innego podmiotu przetwarzającego (podprocesorów)
- pomagania Administratorowi w realizacji praw osób, których dane dotyczą
- pomagania Administratorowi w zapewnieniu bezpieczeństwa przetwarzania
- usunięcia lub zwrotu danych po zakończeniu współpracy, na żądanie Administratora
- udostępniania Administratorowi informacji niezbędnych do wykazania zgodności z art. 28 RODO

## 4. Podprocesorzy

4.1. Administrator wyraża ogólną zgodę na korzystanie z podprocesorów. Aktualna lista podprocesorów: Cloudflare (hosting), Stripe (płatności), Resend (e-mail).

4.2. Procesor poinformuje Administratora o zamiarze dodania lub zmiany podprocesora z 14-dniowym wyprzedzeniem.

## 5. Postanowienia końcowe

5.1. Umowa wchodzi w życie z chwilą akceptacji przez Administratora (Organizatora) podczas rejestracji w Serwisie.

5.2. W sprawach nieuregulowanych zastosowanie mają przepisy RODO i prawa polskiego.

Data wejścia w życie: [DATA]`,
  },
] as const;

export async function seedLegalDocuments() {
  const results: Array<{ type: string; action: string; id?: string }> = [];

  for (const doc of INITIAL_DOCUMENTS) {
    const existing = await getLatestDocument(doc.type);
    if (existing) {
      results.push({ type: doc.type, action: "skipped (already exists)" });
      continue;
    }
    const id = await insertLegalDocument({
      type: doc.type,
      version: 1,
      title: doc.title,
      content: doc.content,
      effectiveAt: Date.now(),
    });
    results.push({ type: doc.type, action: "inserted", id });
  }

  return results;
}
