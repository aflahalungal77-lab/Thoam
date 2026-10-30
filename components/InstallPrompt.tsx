"use client";

import { useEffect, useState } from "react";
import { Download, Globe, X, Smartphone, Zap, ShieldCheck } from "lucide-react";

export default function InstallPrompt({
  audience,
}: {
  audience: "customer" | "owner";
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<any>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = sessionStorage.getItem(`thoam-install-${audience}`);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone;

    if (!dismissed && !standalone) {
      const timer = window.setTimeout(() => setOpen(true), 900);
      // Clear the timer if the component unmounts.
      return () => window.clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, [audience]);

  // Listen for the install event separately so the listener is always registered.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    sessionStorage.setItem(`thoam-install-${audience}`, "1");
  };

  const install = async () => {
    if (prompt) {
      try {
        setInstalling(true);

        await prompt.prompt();
        await prompt.userChoice;

        setPrompt(null);
      } catch (error) {
        console.error("App installation failed:", error);
      } finally {
        setInstalling(false);
        close();
      }
    } else {
      alert(
        "To install Tho'am, open your browser menu and choose 'Install app' or 'Add to Home screen'."
      );
      close();
    }
  };

  const isOwner = audience === "owner";

  return (
    <>
      <style jsx>{`
        .install-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.64);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          animation: backdropIn 0.25s ease both;
        }

        .install-modal {
          position: relative;
          width: 100%;
          max-width: 410px;
          padding: 34px 30px 27px;
          overflow: hidden;
          color: #111;
          background: #fff;
          border: 1px solid rgba(255, 255, 255, 0.65);
          border-radius: 26px;
          text-align: center;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.3);
          animation: modalIn 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .modal-close {
          position: absolute;
          top: 15px;
          right: 15px;
          display: grid;
          place-items: center;
          width: 35px;
          height: 35px;
          padding: 0;
          color: #555;
          background: #f5f5f5;
          border: 1px solid #ededed;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, transform 0.2s;
        }

        .modal-close:hover {
          color: #000;
          background: #eaeaea;
          transform: rotate(90deg);
        }

        .brand-mark {
          display: grid;
          place-items: center;
          width: 64px;
          height: 64px;
          margin: 0 auto 21px;
          color: #fff;
          background: #111;
          border: 1px solid #111;
          border-radius: 21px;
          font-size: 31px;
          font-weight: 850;
          letter-spacing: -3px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #777;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2.8px;
        }

        h2 {
          max-width: 320px;
          margin: 0 auto 12px;
          color: #111;
          font-size: clamp(25px, 6vw, 31px);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -1.3px;
        }

        .description {
          max-width: 315px;
          margin: 0 auto 23px;
          color: #777;
          font-size: 13px;
          line-height: 1.75;
        }

        .benefits {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin: 0 0 23px;
          padding: 15px 8px;
          background: #f8f8f8;
          border: 1px solid #ededed;
          border-radius: 17px;
        }

        .benefit {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #555;
          font-size: 10px;
          font-weight: 650;
        }

        .benefit-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          color: #111;
          background: #fff;
          border: 1px solid #e9e9e9;
          border-radius: 11px;
        }

        .actions {
          display: grid;
          gap: 10px;
        }

        .button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 49px;
          padding: 13px 16px;
          border: 1px solid transparent;
          border-radius: 14px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition:
            transform 0.2s,
            background 0.2s,
            border-color 0.2s;
        }

        .button:active {
          transform: scale(0.98);
        }

        .button-dark {
          color: #fff;
          background: #111;
          border-color: #111;
        }

        .button-dark:hover:not(:disabled) {
          background: #292929;
        }

        .button-dark:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .button-light {
          color: #222;
          background: #fff;
          border-color: #e7e7e7;
        }

        .button-light:hover {
          background: #f7f7f7;
          border-color: #d5d5d5;
        }

        .footnote {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin: 19px 0 0;
          color: #999;
          font-size: 10px;
          line-height: 1.5;
        }

        @keyframes backdropIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 480px) {
          .install-backdrop {
            padding: 15px;
          }

          .install-modal {
            max-width: 370px;
            padding: 30px 21px 23px;
            border-radius: 23px;
          }

          .brand-mark {
            width: 57px;
            height: 57px;
            margin-bottom: 18px;
            border-radius: 18px;
            font-size: 28px;
          }

          .description {
            font-size: 12px;
          }

          .benefits {
            gap: 4px;
            padding: 13px 5px;
          }

          .benefit {
            font-size: 9px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .install-backdrop,
          .install-modal {
            animation: none;
          }

          .button,
          .modal-close {
            transition: none;
          }
        }
      `}</style>

      <div
        className="install-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <section
          className="install-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
          aria-describedby="install-description"
        >
          <button
            className="modal-close"
            onClick={close}
            aria-label="Close installation prompt"
            type="button"
          >
            <X size={17} />
          </button>

          <div className="brand-mark" aria-hidden="true">
            T.
          </div>

          <p className="eyebrow">
            THO&apos;AM {isOwner ? "PARTNER" : "FOOD"}
          </p>

          <h2 id="install-title">
            A better way
            <br />
            to use Tho&apos;am.
          </h2>

          <p className="description" id="install-description">
            Your favourite food experience, just one tap away. Add Tho&apos;am
            to your home screen for quick and easy access.
          </p>

          <div className="benefits">
            <div className="benefit">
              <span className="benefit-icon">
                <Smartphone size={17} />
              </span>
              <span>Quick access</span>
            </div>

            <div className="benefit">
              <span className="benefit-icon">
                <Zap size={17} />
              </span>
              <span>App-like feel</span>
            </div>

            <div className="benefit">
              <span className="benefit-icon">
                <ShieldCheck size={17} />
              </span>
              <span>Easy to use</span>
            </div>
          </div>

          <div className="actions">
            <button
              className="button button-dark"
              onClick={install}
              disabled={installing}
              type="button"
            >
              <Download size={17} />
              {installing ? "Opening installer..." : "Install Tho'am"}
            </button>

            <button
              className="button button-light"
              onClick={close}
              type="button"
            >
              <Globe size={17} />
              Continue on web
            </button>
          </div>

          <p className="footnote">
            <ShieldCheck size={12} />
            No app-store download required
          </p>
        </section>
      </div>
    </>
  );
}