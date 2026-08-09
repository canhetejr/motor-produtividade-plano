-- transicionar_organizacoes() nunca funcionou. Ela fazia:
--
--   update organizacoes set status = 'expirada'
--   where status = 'trialing' and trial_expira_em < now()
--
-- deixando trial_expira_em preenchido. A constraint organizacoes_trial_coerente
-- (migration 20260808170000) exige (status = 'trialing') = (trial_expira_em is
-- not null) — então toda linha que ela tentava transicionar violava a check e a
-- função estourava 23514.
--
-- Passou despercebido porque a rota de cron que a chamaria também não existia:
-- o defeito estava atrás de um caminho que nada percorria. Só apareceu ao
-- executar a função contra dado real.
--
-- Zerar trial_expira_em é o mesmo que toda transição de status já faz no resto
-- do código (ativarOrganizacao, definirSuspensao). O custo é perder a data em
-- que o teste terminou; quem precisa dessa resposta tem criado_em e a trilha do
-- operador. Relaxar a constraint para valer só numa direção preservaria a data,
-- mas afrouxaria o invariante que impede a organização "em teste para sempre" —
-- e esse invariante vale mais do que a data.

begin;

create or replace function public.transicionar_organizacoes() returns table(id uuid, status_novo text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.organizacoes o
  set status = 'expirada', trial_expira_em = null
  where o.status = 'trialing' and o.trial_expira_em < now()
  returning o.id, o.status;
end;
$$;

revoke all on function public.transicionar_organizacoes() from public, anon, authenticated;

commit;
