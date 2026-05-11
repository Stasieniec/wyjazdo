// src/lib/legal/seed-documents.ts
import { getLatestDocument, insertLegalDocument } from "@/lib/db/queries/legal";

const OPERATOR_NAME = "Narrative Impact Jacek Wasilewski";
const OPERATOR_ADDRESS = "ul. Krechowiecka 5 lok. 11, 01-635 Warszawa";
const OPERATOR_NIP = "PL 5221330690";
const CONTACT_EMAIL = "kontakt@wyjazdo.pl";
const RODO_EMAIL = "rodo@wyjazdo.pl";

const REGULAMIN = `# Regulamin serwisu wyjazdo.pl

## 1. Postanowienia ogólne

1.1. Niniejszy Regulamin określa zasady korzystania z serwisu internetowego wyjazdo.pl (dalej: "Serwis"), prowadzonego przez ${OPERATOR_NAME}, ${OPERATOR_ADDRESS}, NIP ${OPERATOR_NIP} (dalej: "Operator").

1.2. Serwis pełni rolę pośrednika technicznego umożliwiającego Uczestnikom zapisywanie się na wydarzenia (wyjazdy, retreaty, warsztaty) organizowane przez Organizatorów — niezależne podmioty zewnętrzne korzystające z Serwisu.

1.3. Korzystanie z Serwisu wymaga akceptacji niniejszego Regulaminu.

## 2. Definicje

- **Serwis** — platforma internetowa dostępna pod adresem wyjazdo.pl oraz subdomenami organizatorów.
- **Operator** — ${OPERATOR_NAME}, NIP ${OPERATOR_NIP}.
- **Organizator** — niezależny podmiot organizujący Wydarzenie, korzystający z Serwisu w celu zbierania zapisów i obsługi płatności.
- **Uczestnik** — osoba fizyczna zapisująca się na Wydarzenie za pośrednictwem Serwisu.
- **Wydarzenie** — wyjazd, retreat, warsztat lub inne wydarzenie organizowane przez Organizatora.

## 3. Zasady korzystania z Serwisu

3.1. Serwis świadczy usługi drogą elektroniczną w rozumieniu ustawy z 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.

3.2. Wymagania techniczne: aktualna przeglądarka internetowa z obsługą JavaScript i plików cookies, dostęp do internetu.

3.3. Z Serwisu mogą korzystać osoby, które ukończyły 16 lat. Uczestnicy poniżej 16 roku życia mogą być zapisywani wyłącznie przez rodzica lub opiekuna prawnego.

3.4. Zabrania się dostarczania treści o charakterze bezprawnym oraz korzystania z Serwisu w sposób zakłócający jego działanie.

## 4. Umowa o udział w Wydarzeniu

4.1. Umowa dotycząca udziału w Wydarzeniu zawierana jest **bezpośrednio między Organizatorem a Uczestnikiem**. Operator nie jest stroną tej umowy.

4.2. Warunki uczestnictwa, ceny, zasady rezygnacji oraz prawo odstąpienia (jeśli ma zastosowanie zgodnie z ustawą o prawach konsumenta) określa Organizator. Uczestnik powinien zapoznać się z tymi warunkami przed dokonaniem zapisu.

4.3. Operator nie odpowiada za niewykonanie lub nienależyte wykonanie Wydarzenia przez Organizatora.

## 5. Płatności

5.1. Płatności realizowane są za pośrednictwem operatora Stripe. Środki przekazywane są na rachunek Organizatora prowadzony w Stripe.

5.2. Operator nie przechowuje danych kart płatniczych ani nie pośredniczy w przepływie środków pieniężnych poza zakresem usług Stripe Connect.

## 6. Prawo odstąpienia

6.1. Zgodnie z art. 38 pkt 12 ustawy z 30 maja 2014 r. o prawach konsumenta prawo odstąpienia od umowy zawartej na odległość nie przysługuje w odniesieniu do umów o świadczenie usług związanych z wydarzeniami rozrywkowymi, sportowymi lub kulturalnymi, jeżeli w umowie oznaczono dzień lub okres świadczenia usługi — co zazwyczaj dotyczy Wydarzeń.

6.2. Konkretne zasady rezygnacji i ewentualnego zwrotu środków określa Organizator. W sprawach rezygnacji Uczestnik powinien skontaktować się bezpośrednio z Organizatorem.

## 7. Reklamacje dotyczące Serwisu

7.1. Reklamacje dotyczące działania samego Serwisu (błędy techniczne, problemy z dostępem) Uczestnik może składać na adres ${CONTACT_EMAIL}. Operator rozpatrzy reklamację w terminie 14 dni od jej otrzymania.

7.2. Reklamacje dotyczące Wydarzenia (treść, jakość, organizacja, zwroty) należy kierować bezpośrednio do Organizatora.

## 8. Pozasądowe rozwiązywanie sporów

8.1. Konsument może skorzystać z platformy ODR Komisji Europejskiej dostępnej pod adresem: https://ec.europa.eu/consumers/odr/

## 9. Postanowienia końcowe

9.1. Operator zastrzega sobie prawo do zmiany Regulaminu. O zmianach Uczestnik zostanie poinformowany z 14-dniowym wyprzedzeniem przy najbliższym korzystaniu z Serwisu.

9.2. W sprawach nieuregulowanych zastosowanie mają przepisy prawa polskiego.`;

const ORGANIZER_TERMS = `# Regulamin dla Organizatorów wyjazdo.pl

## 1. Postanowienia ogólne

1.1. Niniejszy regulamin (dalej: "Regulamin") określa zasady korzystania z platformy wyjazdo.pl przez Organizatorów wydarzeń. Operatorem platformy jest ${OPERATOR_NAME}, ${OPERATOR_ADDRESS}, NIP ${OPERATOR_NIP} (dalej: "Operator").

1.2. Organizator korzysta z Serwisu w ramach prowadzonej działalności gospodarczej lub innej działalności zawodowej. Postanowienia ustawy o prawach konsumenta nie mają zastosowania do umowy między Operatorem a Organizatorem.

## 2. Definicje

- **Organizator** — przedsiębiorca lub inny podmiot korzystający z Serwisu w celu organizacji wyjazdów, retreatów, warsztatów lub innych wydarzeń.
- **Uczestnik** — osoba fizyczna zapisująca się na wydarzenie Organizatora za pośrednictwem Serwisu.
- **Konto** — profil Organizatora w Serwisie, umożliwiający tworzenie wydarzeń, zarządzanie zapisami i obsługę płatności.

## 3. Zakres usług świadczonych Organizatorowi

3.1. Operator udostępnia Organizatorowi narzędzia do:
- tworzenia stron wydarzeń pod własną subdomeną wyjazdo.pl,
- zbierania zapisów i danych Uczestników,
- obsługi płatności online za pośrednictwem operatora Stripe,
- komunikacji transakcyjnej z Uczestnikami.

3.2. Operator nie jest stroną umowy między Organizatorem a Uczestnikiem — pełni rolę pośrednika technicznego.

## 4. Opłaty

4.1. Korzystanie z Serwisu w wersji MVP jest bezpłatne dla Organizatorów.

4.2. Operator zastrzega sobie prawo wprowadzenia opłat w przyszłości. O zmianie cennika Organizator zostanie poinformowany z co najmniej 30-dniowym wyprzedzeniem na adres e-mail przypisany do Konta. Opłaty nie będą pobierane wstecznie.

## 5. Obowiązki Organizatora

5.1. Organizator zobowiązuje się:
- podawać prawdziwe i aktualne dane podczas rejestracji oraz aktualizować je w razie zmian,
- nie zbierać w pytaniach niestandardowych danych szczególnych kategorii (art. 9 RODO — m.in. zdrowie, alergie, dieta medyczna, religia, orientacja seksualna) bez odrębnej, wyraźnej zgody Uczestnika i właściwej podstawy prawnej,
- przestrzegać przepisów RODO wobec Uczestników, jako Administrator ich danych,
- wypełnić wobec Uczestników obowiązki wynikające z ustawy o prawach konsumenta (m.in. obowiązki informacyjne, prawo odstąpienia jeśli ma zastosowanie),
- nie zamieszczać treści niezgodnych z prawem, naruszających prawa osób trzecich lub dobre obyczaje,
- rzetelnie wykonać Wydarzenie wobec Uczestników i odpowiadać za zwroty oraz reklamacje wynikające z treści Wydarzenia.

## 6. Powierzenie przetwarzania danych

6.1. Organizator jest Administratorem danych osobowych Uczestników; Operator — Podmiotem przetwarzającym (procesorem). Szczegółowe warunki określa Umowa powierzenia przetwarzania danych osobowych (DPA), stanowiąca integralną część niniejszego Regulaminu i dostępna pod adresem /dpa.

6.2. Akceptując Regulamin, Organizator akceptuje także DPA.

## 7. Płatności (Stripe Connect)

7.1. Płatności od Uczestników są przyjmowane przez Stripe na rachunek Organizatora. Organizator zawiera odrębną umowę ze Stripe (Connected Account Agreement) i podlega procedurze KYC.

7.2. Operator nie przechowuje danych kart płatniczych ani nie pośredniczy w przepływie środków pieniężnych poza zakresem określonym przez Stripe Connect.

## 8. Odpowiedzialność

8.1. Operator dokłada starań, by Serwis działał nieprzerwanie, ale nie gwarantuje 100% dostępności.

8.2. Odpowiedzialność Operatora wobec Organizatora ograniczona jest do szkód rzeczywistych i nie obejmuje utraconych korzyści, w zakresie dopuszczalnym przepisami prawa.

8.3. Operator nie odpowiada za niewykonanie lub nienależyte wykonanie Wydarzenia przez Organizatora wobec Uczestników.

## 9. Rozwiązanie umowy

9.1. Organizator może w każdej chwili usunąć Konto, kontaktując się na adres ${CONTACT_EMAIL}. Dane Uczestników zostaną usunięte zgodnie z polityką retencji, z zastrzeżeniem obowiązków prawnych Organizatora (np. księgowych).

9.2. Operator może zawiesić lub zamknąć Konto w przypadku rażącego naruszenia Regulaminu, prawa lub bezpieczeństwa Serwisu, po uprzednim wezwaniu do zaprzestania naruszeń.

## 10. Reklamacje

10.1. Reklamacje dotyczące działania Serwisu Organizator może składać na adres ${CONTACT_EMAIL}. Operator rozpatrzy reklamację w terminie 14 dni od jej otrzymania.

## 11. Zmiany Regulaminu

11.1. Operator może zmienić Regulamin z 14-dniowym wyprzedzeniem. O zmianach Organizator zostanie poinformowany na adres e-mail przypisany do Konta.

## 12. Prawo właściwe

12.1. W sprawach nieuregulowanych zastosowanie mają przepisy prawa polskiego.`;

const PRIVACY_POLICY = `# Polityka prywatności wyjazdo.pl

## 1. Administrator danych

Administratorem Twoich danych osobowych w zakresie korzystania z Serwisu wyjazdo.pl jest ${OPERATOR_NAME}, ${OPERATOR_ADDRESS}, NIP ${OPERATOR_NIP} (dalej: "Administrator").

Kontakt w sprawach ochrony danych: ${RODO_EMAIL}
Kontakt ogólny: ${CONTACT_EMAIL}

W odniesieniu do danych Uczestników wydarzeń: Administratorem tych danych jest Organizator wydarzenia, na które się zapisujesz. Operator wyjazdo.pl działa wówczas jako Podmiot przetwarzający (procesor) Organizatora — na podstawie umowy powierzenia.

## 2. Cele i podstawy przetwarzania

| Cel | Podstawa prawna | Okres przechowywania |
|-----|-----------------|----------------------|
| Prowadzenie konta Organizatora i świadczenie usług Serwisu | art. 6 ust. 1 lit. b RODO — wykonanie umowy | Czas trwania umowy + 6 lat (przedawnienie roszczeń) |
| Obsługa zapisów Uczestników na wydarzenia | art. 6 ust. 1 lit. b RODO — wykonanie umowy (w imieniu Organizatora) | 12 miesięcy po zakończeniu wydarzenia, chyba że Organizator określi inaczej |
| Obsługa płatności online (Stripe) | art. 6 ust. 1 lit. b RODO — wykonanie umowy | Czas trwania umowy + okres przedawnienia |
| Rozliczenia podatkowe i księgowe | art. 6 ust. 1 lit. c RODO — obowiązek prawny | 5 lat od końca roku podatkowego |
| Zapewnienie bezpieczeństwa Serwisu, zapobieganie nadużyciom | art. 6 ust. 1 lit. f RODO — uzasadniony interes | Do 12 miesięcy |
| Dochodzenie i obrona roszczeń | art. 6 ust. 1 lit. f RODO — uzasadniony interes | Do upływu okresu przedawnienia |
| Rejestrowanie zgód i akceptacji dokumentów (audyt RODO) | art. 6 ust. 1 lit. c RODO + art. 7 ust. 1 RODO | 6 lat |
| Marketing bezpośredni Operatora (jeśli włączony za zgodą) | art. 6 ust. 1 lit. a RODO — zgoda | Do wycofania zgody |

## 3. Zakres przetwarzanych danych

- **Organizatorzy:** dane konta (imię, e-mail, nazwa działalności), dane kontaktowe, identyfikatory Stripe Connect, log akceptacji dokumentów (data, adres IP).
- **Uczestnicy:** imię, nazwisko, e-mail, opcjonalnie numer telefonu, odpowiedzi na pytania niestandardowe Organizatora, dane o płatnościach, log akceptacji zgód (data, adres IP).

Operator nie zbiera danych szczególnych kategorii (art. 9 RODO) na poziomie platformy. Organizatorzy zobowiązani są nie zbierać takich danych w pytaniach niestandardowych bez odrębnej, wyraźnej zgody Uczestnika i właściwej podstawy prawnej.

## 4. Odbiorcy danych (podprocesorzy)

Twoje dane mogą być przekazywane następującym podmiotom, z którymi Administrator zawarł umowy zapewniające odpowiedni poziom ochrony danych:

| Podmiot | Cel | Lokalizacja | Mechanizm transferu |
|---------|-----|-------------|---------------------|
| Cloudflare, Inc. | Hosting, baza danych, zabezpieczenia | UE / USA | Standardowe Klauzule Umowne (SCC) |
| Clerk, Inc. | Uwierzytelnianie organizatorów | USA | SCC |
| Resend, Inc. | Wysyłka e-maili transakcyjnych | USA | SCC |
| Stripe Payments Europe Ltd. | Obsługa płatności | Irlandia / USA | SCC |

Aktualna lista podprocesorów jest publikowana w Serwisie. O zmianie listy informujemy Organizatorów z 14-dniowym wyprzedzeniem.

Dane Uczestników są dodatkowo udostępniane Organizatorowi wydarzenia, na które się zapisują — to Organizator jest Administratorem tych danych w odniesieniu do organizacji wydarzenia.

## 5. Transfer danych poza EOG

Niektórzy podprocesorzy przetwarzają dane poza Europejskim Obszarem Gospodarczym (głównie w USA). Transfer odbywa się na podstawie Standardowych Klauzul Umownych (SCC) zatwierdzonych przez Komisję Europejską (decyzja 2021/914) oraz dodatkowych zabezpieczeń technicznych (szyfrowanie w transporcie i w spoczynku).

## 6. Twoje prawa

Przysługuje Ci prawo do:
- dostępu do danych (art. 15 RODO),
- sprostowania danych (art. 16 RODO),
- usunięcia danych — "prawo do bycia zapomnianym" (art. 17 RODO),
- ograniczenia przetwarzania (art. 18 RODO),
- przenoszenia danych (art. 20 RODO),
- sprzeciwu wobec przetwarzania (art. 21 RODO),
- wycofania zgody w dowolnym momencie, bez wpływu na zgodność z prawem przetwarzania dokonanego przed wycofaniem (art. 7 ust. 3 RODO),
- wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.

Aby skorzystać z praw, napisz na ${RODO_EMAIL}. Odpowiadamy bez zbędnej zwłoki, nie później niż w terminie 30 dni (art. 12 ust. 3 RODO). Jeśli żądanie dotyczy danych Uczestnika, wniosek może wymagać przekazania go Organizatorowi jako Administratorowi tych danych.

## 7. Informacja o wymogu podania danych

Podanie danych jest dobrowolne, ale niezbędne do korzystania z Serwisu. Bez podania danych oznaczonych jako wymagane nie jest możliwe założenie konta lub zapisanie się na wydarzenie.

## 8. Profilowanie i automatyczne decyzje

Serwis nie podejmuje wobec Ciebie zautomatyzowanych decyzji wywołujących skutki prawne lub w podobny sposób istotnie wpływających, w rozumieniu art. 22 RODO.

## 9. Cookies

Szczegółowe informacje o plikach cookies wykorzystywanych w Serwisie znajdziesz w [Polityce cookies](/cookies).

## 10. Zgłaszanie naruszeń

Jeśli podejrzewasz naruszenie ochrony danych, napisz na ${RODO_EMAIL}. Naruszenia o wysokim ryzyku zgłaszamy do Prezesa UODO w terminie 72 godzin (art. 33 RODO).`;

const DPA = `# Umowa powierzenia przetwarzania danych osobowych

zawarta pomiędzy:

**Administratorem** — Organizatorem korzystającym z Serwisu wyjazdo.pl (dalej: "Administrator")

a

**Podmiotem przetwarzającym** — ${OPERATOR_NAME}, ${OPERATOR_ADDRESS}, NIP ${OPERATOR_NIP} (dalej: "Procesor"), operatorem Serwisu wyjazdo.pl.

## 1. Przedmiot umowy

1.1. Administrator powierza Procesorowi przetwarzanie danych osobowych Uczestników wydarzeń organizowanych za pośrednictwem Serwisu, na zasadach określonych w art. 28 RODO i niniejszej umowie.

## 2. Zakres powierzenia

- **Kategorie osób:** Uczestnicy wydarzeń Administratora, w tym dodatkowi uczestnicy zgłoszeni przez osobę zapisującą (np. członkowie rodziny).
- **Rodzaje danych:** imię, nazwisko, adres e-mail, numer telefonu, odpowiedzi na pytania niestandardowe ustalone przez Administratora, dane o płatnościach (status, kwota, identyfikator Stripe), zapisy zgód (data, IP).
- **Charakter przetwarzania:** zbieranie, przechowywanie, organizowanie, udostępnianie Administratorowi, przesyłanie wiadomości transakcyjnych Uczestnikom w imieniu Administratora.
- **Cel przetwarzania:** umożliwienie rejestracji Uczestników na wydarzenia, obsługa płatności i komunikacja transakcyjna.
- **Czas trwania:** okres korzystania z Serwisu przez Administratora oraz uzasadniony okres po jego zakończeniu, niezbędny do rozliczenia.

## 3. Obowiązki Procesora

Procesor zobowiązuje się do:
- przetwarzania danych wyłącznie na udokumentowane polecenie Administratora,
- zapewnienia, że osoby upoważnione do przetwarzania zobowiązały się do zachowania poufności,
- wdrożenia odpowiednich środków technicznych i organizacyjnych (szyfrowanie w transporcie TLS, szyfrowanie spoczynkowe, kontrola dostępu, kopie zapasowe, logi audytowe),
- przestrzegania warunków korzystania z usług innego podmiotu przetwarzającego (podprocesorów) zgodnie z art. 28 ust. 2 i 4 RODO,
- pomagania Administratorowi w realizacji praw osób, których dane dotyczą (art. 12-22 RODO),
- pomagania Administratorowi w zapewnieniu bezpieczeństwa przetwarzania, zgłaszania naruszeń (art. 33-34 RODO) oraz oceny skutków (art. 35-36 RODO),
- zgłaszania Administratorowi naruszeń ochrony danych bez zbędnej zwłoki, nie później niż w terminie 48 godzin od ich wykrycia,
- usunięcia lub zwrotu danych po zakończeniu współpracy, na żądanie Administratora, chyba że obowiązujące przepisy prawa nakazują zachowanie danych,
- udostępniania Administratorowi informacji niezbędnych do wykazania zgodności z art. 28 RODO oraz umożliwienia audytu przy zachowaniu poufności i 30-dniowym wyprzedzeniu.

## 4. Podprocesorzy

4.1. Administrator wyraża ogólną pisemną zgodę na korzystanie przez Procesora z następujących podprocesorów:

| Podmiot | Zakres usług | Lokalizacja |
|---------|--------------|-------------|
| Cloudflare, Inc. | Hosting, baza danych D1, magazyn plików, zabezpieczenia | UE (preferowana) / USA |
| Clerk, Inc. | Uwierzytelnianie konta Administratora | USA |
| Resend, Inc. | Wysyłka e-maili transakcyjnych | USA |
| Stripe Payments Europe Ltd. | Obsługa płatności od Uczestników na rachunek Administratora | Irlandia / USA |

4.2. Procesor poinformuje Administratora o zamiarze dodania lub zmiany podprocesora z co najmniej 14-dniowym wyprzedzeniem za pośrednictwem e-maila przypisanego do Konta. Administrator może w tym terminie wnieść uzasadniony sprzeciw — w razie braku zgody każda ze stron może rozwiązać umowę powierzenia.

4.3. Transfery do państw trzecich (głównie USA) odbywają się na podstawie Standardowych Klauzul Umownych zatwierdzonych przez Komisję Europejską (decyzja 2021/914) oraz dodatkowych zabezpieczeń technicznych.

## 5. Odpowiedzialność

5.1. Procesor odpowiada za szkody wyrządzone Administratorowi w wyniku naruszenia przez Procesora obowiązków wynikających z RODO i niniejszej umowy.

5.2. Strony ponoszą odpowiedzialność wobec osób, których dane dotyczą, na zasadach określonych w art. 82 RODO.

## 6. Postanowienia końcowe

6.1. Umowa wchodzi w życie z chwilą akceptacji przez Administratora podczas rejestracji w Serwisie.

6.2. W sprawach nieuregulowanych zastosowanie mają przepisy RODO i prawa polskiego.`;

const COOKIE_POLICY = `# Polityka cookies wyjazdo.pl

## 1. Czym są pliki cookies?

Pliki cookies to małe pliki tekstowe zapisywane przez przeglądarkę na Twoim urządzeniu końcowym (komputerze, telefonie, tablecie) podczas korzystania ze stron internetowych.

## 2. Jakie cookies wykorzystujemy?

Serwis wyjazdo.pl wykorzystuje wyłącznie pliki cookies **niezbędne do prawidłowego funkcjonowania** Serwisu — bez nich nie można się zalogować ani bezpiecznie korzystać z platformy. Nie używamy cookies analitycznych, marketingowych ani profilujących, dlatego nie wymagamy zgody na ich stosowanie zgodnie z art. 173 ust. 3 ustawy z 12 lipca 2024 r. — Prawo komunikacji elektronicznej (PKE).

| Cookie | Cel | Czas |
|--------|-----|------|
| \`__session\`, \`__client_uat\` (Clerk) | Utrzymanie sesji zalogowanego organizatora | Sesja / do 7 dni |
| \`cf_*\` (Cloudflare) | Ochrona przed atakami i botami, bezpieczeństwo połączenia | Sesja / do 30 dni |
| \`next-*\` (Next.js) | Stan aplikacji i preferencje wyświetlania | Sesja |

## 3. Cookies podmiotów trzecich

3.1. Strony płatności obsługiwane przez Stripe mogą ustawiać własne pliki cookies podczas procesu płatności. Stripe stosuje je do wykrywania oszustw i bezpieczeństwa transakcji. Szczegóły: https://stripe.com/cookies-policy/legal

## 4. Co jeśli wprowadzimy analitykę?

Jeżeli w przyszłości wprowadzimy narzędzia analityczne, marketingowe lub pomiaru oglądalności (np. Plausible, Google Analytics, Meta Pixel), pojawi się wówczas baner zgody na cookies. Nie uruchomimy tych narzędzi bez Twojej wyraźnej zgody, zgodnej z wymogami PKE i RODO.

## 5. Zarządzanie cookies

Możesz w każdej chwili usunąć pliki cookies lub zablokować ich zapisywanie w ustawieniach przeglądarki. Wyłączenie cookies niezbędnych może uniemożliwić zalogowanie się i korzystanie z Serwisu.

## 6. Operator

Operatorem Serwisu jest ${OPERATOR_NAME}, ${OPERATOR_ADDRESS}, NIP ${OPERATOR_NIP}. Pytania dotyczące cookies kieruj na adres ${RODO_EMAIL}.`;

const INITIAL_DOCUMENTS = [
  { type: "regulamin" as const, title: "Regulamin serwisu wyjazdo.pl", content: REGULAMIN },
  { type: "organizer_terms" as const, title: "Regulamin dla Organizatorów wyjazdo.pl", content: ORGANIZER_TERMS },
  { type: "privacy_policy" as const, title: "Polityka prywatności wyjazdo.pl", content: PRIVACY_POLICY },
  { type: "dpa" as const, title: "Umowa powierzenia przetwarzania danych osobowych", content: DPA },
  { type: "cookie_policy" as const, title: "Polityka cookies wyjazdo.pl", content: COOKIE_POLICY },
] as const;

export async function seedLegalDocuments() {
  const results: Array<{ type: string; action: string; id?: string; version?: number }> = [];

  for (const doc of INITIAL_DOCUMENTS) {
    const existing = await getLatestDocument(doc.type);
    if (existing && existing.content === doc.content) {
      results.push({ type: doc.type, action: "skipped (unchanged)", version: existing.version });
      continue;
    }
    const nextVersion = existing ? existing.version + 1 : 1;
    const id = await insertLegalDocument({
      type: doc.type,
      version: nextVersion,
      title: doc.title,
      content: doc.content,
      effectiveAt: Date.now(),
    });
    results.push({
      type: doc.type,
      action: existing ? "updated (new version)" : "inserted",
      id,
      version: nextVersion,
    });
  }

  return results;
}
