"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      <span aria-hidden="true">🖨️</span> Print card
    </Button>
  );
}
