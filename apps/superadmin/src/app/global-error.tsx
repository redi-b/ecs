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
            align-items: center;
            background: var(--failure-bg);
            color: var(--failure-fg);
            display: flex;
            font-family: ui-sans-serif, system-ui, sans-serif;
            justify-content: center;
            margin: 0;
            min-height: 100vh;
            padding: 24px;
          }
          main { max-width: 480px; width: 100%; }
          h1 { font-size: 32px; letter-spacing: -0.04em; margin: 0; }
          .failure-description {
            color: var(--failure-muted);
            line-height: 1.6;
            margin: 16px 0 28px;
          }
          button {
            background: var(--failure-primary);
            border: 0;
            border-radius: 10px;
            color: var(--failure-primary-fg);
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            min-height: 40px;
            padding: 11px 18px;
          }
          button:focus-visible { outline: 3px solid var(--failure-ring); outline-offset: 3px; }
          @media (max-width: 480px) { h1 { font-size: 28px; } }
        `}</style>
      </head>
      <body>
        <main>
          <h1>This workspace could not be opened</h1>
          <p className="failure-description">
            Try opening Operations again. Your saved work is not affected.
          </p>
          <button onClick={reset} type="button">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
