
import { useEffect, useRef } from "react";
import "./NewsPopup.css";

interface NewsPopupProps {
  ready: boolean;
}

export default function NewsPopup({ ready }: NewsPopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!ready) return;

    // Show only once per browser session
    if (sessionStorage.getItem("kalypsis-news-v1")) return;

    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [ready]);

  const closePopup = () => {
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className="kalypsis-news-popup"
      aria-labelledby="news-title"
      onClose={() => {
        sessionStorage.setItem("kalypsis-news-v1", "seen");
      }}
    >
      <button
        className="news-close"
        onClick={closePopup}
        aria-label="Κλείσιμο ανακοίνωσης"
      >
        ×
      </button>

      <span className="news-label">ΑΝΑΚΟΙΝΩΣΗ</span>

      <h2 id="news-title">Νέα από την Kalypsis!</h2>

      <p>
        Μείνετε ενημερωμένοι για τις τελευταίες
        ανακοινώσεις και ενημερώσεις της πλατφόρμας.
      </p>

      <button className="news-button" onClick={closePopup}>
        Συνέχεια στην εφαρμογή
      </button>
    </dialog>
  );
}
