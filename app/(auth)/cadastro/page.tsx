import { signup } from "@/app/actions";
import { Campo, Enviar } from "../auth-pecas";
import { LinkTroca } from "../troca";

export const metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <form action={signup} className="nx-hud au-painel">
      <p className="nx-kicker">Novo acesso</p>
      <h1>Crie sua conta</h1>
      <p className="au-sub">Comece grátis e deixe o agente montar a próxima compra do mês.</p>

      {erro && <p className="au-erro" role="alert">{erro}</p>}

      <Campo rotulo="Nome" name="name" icone="nome" autoComplete="name" minLength={2} maxLength={80} />
      <Campo rotulo="E-mail" name="email" type="email" icone="email" autoComplete="email" maxLength={200} />
      <Campo rotulo="Senha" name="password" type="password" icone="senha" autoComplete="new-password" minLength={8} maxLength={200} dica="Mínimo de 8 caracteres." />

      <p className="au-aviso">
        Ao criar a conta, você concorda que a lista e o histórico de propostas sejam armazenados para o funcionamento do serviço. Você pode pedir a exclusão dos dados.
      </p>

      <Enviar enviando="Criando conta…">Criar conta</Enviar>

      <p className="au-troca">
        Já tem conta? <LinkTroca href="/login">Entrar</LinkTroca>
      </p>
    </form>
  );
}
