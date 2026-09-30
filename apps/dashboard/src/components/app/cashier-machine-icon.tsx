import type { SVGProps } from "react";

/** Cashier-machine mark supplied for the POS entry point. */
export function CashierMachineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M4 2h16v12h-7v2h-2v-2H4V2Zm2 2v8h12V4H6Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M3 16h18v6H3v-6Zm2 2v2h14v-2H5Z" />
      <path d="M14 18.25h3v1.5h-3z" />
      <path
        data-slot="cashier-currency-cue"
        d="M11.25 4.75h1.5v.75H15V7h-4.5a.5.5 0 0 0 0 1h3a2 2 0 0 1 0 4h-.75v.75h-1.5V12H9v-1.5h4.5a.5.5 0 0 0 0-1h-3a2 2 0 0 1 0-4h.75v-.75Z"
        fill="currentColor"
        transform="translate(2.4 0.9) scale(.8)"
      />
    </svg>
  );
}
