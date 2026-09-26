"use client";

import React from "react";

export function PrintButton() {
  const handlePrint = () => {
    // TODO: Replace with real PDF generation (e.g. a print-optimized route or a PDF library) once time allows
    // window.print() is a stopgap that lets the button do something meaningful today.
    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      Download Receipt (PDF)
    </button>
  );
}
