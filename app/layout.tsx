import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND} · Agente de IA de compras e estoque`,
  description: "Um agente de IA que pesquisa, compara e propõe a melhor compra. Você aprova dentro do seu limite.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
