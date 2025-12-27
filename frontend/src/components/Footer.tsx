"use client";

export function Footer() {
  return (
    <footer className="text-center py-8 mt-8 border-t border-[#2d3a50] text-sm text-[#64748b]">
      Data from{" "}
      <a
        href="https://fred.stlouisfed.org"
        target="_blank"
        className="text-cyan-400 hover:underline"
      >
        FRED
      </a>
      ,{" "}
      <a
        href="https://fiscaldata.treasury.gov"
        target="_blank"
        className="text-cyan-400 hover:underline"
      >
        Treasury
      </a>
      , and{" "}
      <a
        href="https://www.financialresearch.gov"
        target="_blank"
        className="text-cyan-400 hover:underline"
      >
        OFR
      </a>
    </footer>
  );
}
