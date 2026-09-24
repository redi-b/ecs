"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            color-scheme: light dark;
            --failure-bg: oklch(0.975 0.008 238);
            --failure-fg: oklch(0.22 0.025 242);
            --failure-muted: oklch(0.48 0.025 240);
            --failure-primary: oklch(0.54 0.15 238);
            --failure-primary-fg: oklch(0.98 0.008 238);
            --failure-ring: oklch(0.6 0.13 234);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --failure-bg: oklch(0.155 0.02 244);
              --failure-fg: oklch(0.93 0.012 235);
              --failure-muted: oklch(0.7 0.025 237);
              --failure-primary: oklch(0.66 0.12 229);
              --failure-primary-fg: oklch(0.16 0.025 244);
              --failure-ring: oklch(0.7 0.125 229);
            }
          }
          * { box-sizing: border-box; }
          body {
            background: var(--failure-bg);
            color: var(--failure-fg);
            font-family: ui-sans-serif, system-ui, sans-serif;
            margin: 0;
            min-height: 100vh;
            padding: 24px;
          }
          main { align-items:center; display:flex; margin:auto; max-width:640px; min-height:calc(100vh - 48px); width:100%; }
          .copy { max-width:520px }
          p { color: var(--failure-muted); line-height: 1.6; margin: 14px 0 26px; }
          h1 { font-size:clamp(32px,6vw,52px); letter-spacing:-.045em; line-height:1.05; margin:0; }
          button {
            background: var(--failure-primary);
            border: 0;
            border-radius: 999px;
            color: var(--failure-primary-fg);
            cursor: pointer;
            font-size: 14px;
            font-weight: 700;
            min-height: 40px;
            padding: 11px 18px;
          }
          button:focus-visible { outline: 3px solid var(--failure-ring); outline-offset: 3px; }
        `}</style>
      </head>
      <body>
        <main>
          <div className="copy">
            <h1>Dashboard temporarily unavailable</h1>
            <p>Try opening the dashboard again. Your saved shop data is not affected.</p>
            <button onClick={reset} type="button">
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
