# Leerkaarten Belfort & Carnegie

Flashcards en quiz over Belfort (Straight Line) en Carnegie. Je logt in met een link per mail, en je voortgang en quizuitslagen worden in Supabase bewaard. Daardoor zie je ze op elk apparaat.

## Wat zit erin

| Bestand | Wat het doet |
|---|---|
| `index.html` | De pagina met de opmaak |
| `app.js` | De werking: inloggen, flashcards, quiz, opslaan |
| `config.js` | Hier vul je je Supabase-adres en sleutel in |
| `supabase/01_tabellen.sql` | Maakt de tabellen en de beveiliging aan |
| `supabase/02_kaarten.sql` | Zet de 77 leerkaarten in de database |

Er is geen installatie of build-stap nodig. Het zijn gewone bestanden die GitHub Pages gratis online zet.

---

## Stap 1: Supabase-project aanmaken

1. Ga naar [supabase.com/dashboard](https://supabase.com/dashboard) en klik op **New project**.
2. Geef het de naam `leerkaarten`, kies een sterk databasewachtwoord (bewaar het ergens) en kies als regio **Central EU (Frankfurt)**.
3. Wacht een paar minuten tot het project klaar is.

## Stap 2: Tabellen en kaarten aanmaken

1. Ga in je project naar **SQL Editor** en klik op **New query**.
2. Plak de inhoud van `supabase/01_tabellen.sql` en klik op **Run**. Je zou "Success" moeten zien.
3. Maak nog een nieuwe query, plak `supabase/02_kaarten.sql` en klik op **Run**.
4. Controleer het via **Table Editor** → `cards`: daar staan nu 77 rijen.

## Stap 3: GitHub-repository maken

1. Ga naar [github.com/new](https://github.com/new).
2. Naam: `leerkaarten`. Kies **Public**, want GitHub Pages is gratis voor openbare repositories. Je gegevens staan in Supabase en zijn beveiligd; in de repository staat alleen de code.
3. Klik op **Create repository** en daarna op **uploading an existing file**.
4. Sleep alle bestanden erin, inclusief de map `supabase`, en klik op **Commit changes**.

## Stap 4: Supabase koppelen in config.js

1. Ga in Supabase naar **Project Settings → API**. Je kunt ook bovenaan op **Connect** klikken.
2. Kopieer de **Project URL** en de **anon / publishable key**.
3. Open in GitHub het bestand `config.js`, klik op het potloodje en vervang de twee voorbeeldwaarden.
4. Klik op **Commit changes**.

> Gebruik nooit de `service_role` of `secret` key. Die geeft volledige toegang en hoort niet in een website.

## Stap 5: Online zetten met GitHub Pages

1. Ga in je repository naar **Settings → Pages**.
2. Kies bij **Source** de optie **Deploy from a branch**, met branch `main` en map `/ (root)`. Klik op **Save**.
3. Na een minuut of twee staat je app op `https://JOUW-GEBRUIKERSNAAM.github.io/leerkaarten/`.

## Stap 6: Inloglink laten terugkomen bij je app

1. Ga in Supabase naar **Authentication → URL Configuration**.
2. Vul bij **Site URL** je adres uit stap 5 in.
3. Voeg bij **Redirect URLs** hetzelfde adres toe en klik op **Save**.

## Stap 7: Testen

Open je app, vul je e-mailadres in en klik op de link in de mail. Open die link op hetzelfde apparaat. Je komt dan ingelogd in de app.

---

## Goed om te weten

- **Kaarten aanpassen of toevoegen:** dat doe je in Supabase via **Table Editor → cards**. Geef een nieuwe kaart een unieke `id`, bijvoorbeeld `C055`.
- **Een gratis Supabase-project pauzeert** na ongeveer een week zonder gebruik. In het dashboard zet je het weer aan met **Restore**.
- **Inlogmails:** de ingebouwde mailservice van Supabase verstuurt maar een paar mails per uur. Voor jezelf is dat genoeg.
- **Later het oefenlogboek:** dat krijgt eigen tabellen naast deze, met dezelfde login.
