"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} aria-label="Print card" title="Print" className="print:hidden">
      <span aria-hidden="true">🖨️</span> Print
    </Button>
  );
}
