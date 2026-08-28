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
          main { align-items:center; display:grid; gap:64px; grid-template-columns:minmax(0,1fr) minmax(280px,.72fr); margin:auto; max-width:1050px; min-height:calc(100vh - 48px); width:100%; }
          .copy { max-width:520px }
          .eyebrow { color:var(--failure-primary); font-size:12px; font-weight:750; letter-spacing:.16em; margin:0 0 12px; text-transform:uppercase }
          p { color: var(--failure-muted); line-height: 1.6; margin: 14px 0 26px; }
          h1 { font-size:clamp(34px,6vw,58px); letter-spacing:-.052em; line-height:1; margin:0; }
          .viewport { border:1px solid color-mix(in oklch,var(--failure-primary) 28%,var(--failure-muted)); border-radius:24px; min-height:330px; overflow:hidden; position:relative; transform:rotate(1.5deg) }
          .bar { align-items:center; border-bottom:1px solid color-mix(in oklch,var(--failure-muted) 30%,transparent); display:flex; gap:6px; height:44px; padding:0 14px }
          .bar i,.status i { background:var(--failure-primary); border-radius:50%; height:7px; opacity:.5; width:7px }
          .bar span { background:color-mix(in oklch,var(--failure-muted) 18%,transparent); border-radius:99px; height:8px; margin-left:auto; width:45% }
          .frame { border:1px solid color-mix(in oklch,var(--failure-primary) 28%,transparent); border-radius:14px; position:absolute }
          .one{inset:74px 12% 48%}.two{inset:62% 54% 44px 12%}.three{inset:62% 12% 44px 51%}
          .status { align-items:center; border-top:1px solid color-mix(in oklch,var(--failure-muted) 30%,transparent); bottom:0; display:flex; font-size:10px; gap:8px; height:36px; left:0; letter-spacing:.14em; padding:0 14px; position:absolute; right:0 }
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
          @media(max-width:760px){main{grid-template-columns:1fr}.viewport{min-height:260px}}
        `}</style>
      </head>
      <body>
        <main>
          <div className="copy">
            <p className="eyebrow">Connection paused</p>
            <h1>Dashboard temporarily unavailable</h1>
            <p>Your shop data is unchanged. Try opening the dashboard again.</p>
            <button onClick={reset} type="button">
              Try again
            </button>
          </div>
          <div aria-hidden="true" className="viewport">
            <div className="bar">
              <i />
              <i />
              <i />
              <span />
            </div>
            <b className="frame one" />
            <b className="frame two" />
            <b className="frame three" />
            <div className="status">
              <i /> ECS
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
