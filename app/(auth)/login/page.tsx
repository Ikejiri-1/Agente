import { login } from "@/app/actions";
import { Campo, Enviar } from "../auth-pecas";
import { LinkTroca } from "../troca";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <form action={login} className="nx-hud au-painel">
      <p className="nx-kicker">Acesso</p>
      <h1>Bem-vindo de volta</h1>
      <p className="au-sub">Entre para ver as propostas do seu agente e aprovar as próximas compras.</p>

      {erro && <p className="au-erro" role="alert">{erro}</p>}

      <Campo rotulo="E-mail" name="email" type="email" icone="email" autoComplete="email" maxLength={200} />
      <Campo rotulo="Senha" name="password" type="password" icone="senha" autoComplete="current-password" maxLength={200} />

      <Enviar enviando="Autenticando…">Entrar</Enviar>

      <p className="au-troca">
        Não tem conta? <LinkTroca href="/cadastro">Criar conta</LinkTroca>
      </p>
    </form>
  );
}
