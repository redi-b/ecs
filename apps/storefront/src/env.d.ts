declare namespace App {
  interface Locals {
    /** Resolved by the shared product route, never inferred from a URL alone. */
    analyticsProduct?: {
      id: string;
      handle: string | null;
      title: string | null;
      variantIds: string[];
    };
  }
}
