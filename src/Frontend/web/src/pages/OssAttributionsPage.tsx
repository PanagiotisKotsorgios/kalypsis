import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

// Open-Source Attributions — υποχρέωση από τις άδειες MIT/Apache/BSD/ISC
// των βιβλιοθηκών που χρησιμοποιούμε. Λίστα των κύριων dependencies και
// pointers στις πλήρεις άδειες.

export function OssAttributionsPage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.oss.eyebrow", "Open-Source")}
      title={t("legal.oss.title", "Αναγνώριση Βιβλιοθηκών Ανοικτού Κώδικα")}
      lastUpdated={t("legal.lastUpdated", { date: "16 Ιουλίου 2026" })}
      intro={
        <p>
          Η Πλατφόρμα Kalypsis χρησιμοποιεί βιβλιοθήκες ανοικτού κώδικα (OSS).
          Ευχαριστούμε τους/τις δημιουργούς και τηρούμε τις αντίστοιχες άδειες.
          Η πλήρης λίστα με τους κωδικούς και τα κείμενα αδειών είναι διαθέσιμη
          κατόπιν αιτήματος στο <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>.
        </p>
      }
      sections={[
        {
          id: "frontend",
          heading: "1. Βασικές Βιβλιοθήκες Frontend",
          body: (
            <ul>
              <li><strong>React</strong> — MIT License, © Meta Platforms Inc.</li>
              <li><strong>Vite</strong> — MIT License, © Evan You</li>
              <li><strong>TypeScript</strong> — Apache 2.0, © Microsoft</li>
              <li><strong>Material-UI (MUI)</strong> — MIT License, © Call-Em-All</li>
              <li><strong>React Router</strong> — MIT License, © Remix Software</li>
              <li><strong>@tanstack/react-query</strong> — MIT License, © Tanner Linsley</li>
              <li><strong>react-i18next</strong> — MIT License, © i18next</li>
              <li><strong>axios</strong> — MIT License</li>
            </ul>
          )
        },
        {
          id: "backend",
          heading: "2. Βασικές Βιβλιοθήκες Backend",
          body: (
            <ul>
              <li><strong>.NET / ASP.NET Core</strong> — MIT License, © Microsoft</li>
              <li><strong>Entity Framework Core</strong> — MIT License, © Microsoft</li>
              <li><strong>Pomelo.EntityFrameworkCore.MySql</strong> — MIT License</li>
              <li><strong>MySqlConnector</strong> — MIT License</li>
              <li><strong>MediatR</strong> — Apache 2.0 (upstream), © Jimmy Bogard</li>
              <li><strong>FluentValidation</strong> — Apache 2.0</li>
              <li><strong>BCrypt.Net-Next</strong> — MIT License</li>
              <li><strong>MySQL Community Server</strong> — GPL v2.0 (server binary, δεν διανέμεται με τον κώδικά μας)</li>
              <li><strong>nginx</strong> — 2-clause BSD (runtime dependency)</li>
            </ul>
          )
        },
        {
          id: "licenses",
          heading: "3. Πλήρη Κείμενα Αδειών",
          body: (
            <>
              <p>Τα πλήρη κείμενα των βασικών αδειών είναι διαθέσιμα στους παρακάτω συνδέσμους:</p>
              <ul>
                <li><a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener">MIT License</a></li>
                <li><a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">Apache License 2.0</a></li>
                <li><a href="https://opensource.org/licenses/BSD-2-Clause" target="_blank" rel="noopener">BSD 2-Clause</a></li>
                <li><a href="https://opensource.org/licenses/ISC" target="_blank" rel="noopener">ISC License</a></li>
                <li><a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html" target="_blank" rel="noopener">GNU GPL v2.0</a></li>
              </ul>
              <p>
                Καμία GPL/AGPL-αδειοδοτημένη βιβλιοθήκη δεν διανέμεται ως μέρος
                του κώδικά μας — δεν έχουμε copyleft υποχρεώσεις.
              </p>
            </>
          )
        },
        {
          id: "credits",
          heading: "4. Ευχαριστίες",
          body: (
            <p>
              Ένα ευχαριστώ στην ευρύτερη open-source κοινότητα: χωρίς εσάς αυτή η
              πλατφόρμα δεν θα υπήρχε. Αν είστε συντηρητής μιας από τις παραπάνω
              βιβλιοθήκες και έχετε παρατήρηση για το πώς την αναφέρουμε,
              στείλτε μας email — θα διορθωθεί άμεσα.
            </p>
          )
        }
      ]}
    />
  );
}
