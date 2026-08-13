-- Setup inicial por pessoa.
--
-- A conexão com o Google é por colaborador (google_workspace_conexoes tem
-- colaborador_id como chave), então o "já passei pelo setup" também é por
-- pessoa, não por organização: gestor e colaborador fazem o mesmo caminho na
-- primeira entrada.
--
-- Nulo = ainda não passou pelo setup. Quem já usa o sistema hoje não deve ser
-- levado para uma tela de boas-vindas no próximo login, então o backfill
-- marca todo mundo que já existe como concluído — igual ao que
-- 20260811214331 fez com troca_senha_obrigatoria.
alter table public.colaboradores
  add column if not exists setup_concluido_em timestamptz;

update public.colaboradores
set setup_concluido_em = now()
where setup_concluido_em is null;
