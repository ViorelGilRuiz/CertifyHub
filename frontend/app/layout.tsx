import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = { title: "Diagnóstico | CertifyHub" };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
