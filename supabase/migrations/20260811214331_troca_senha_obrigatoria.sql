-- A senha inicial e a senha definida por reset administrativo não devem
-- permanecer como credenciais permanentes. O marcador fica no perfil, porque
-- a sessão de Auth não informa se a senha atual foi provisória.
alter table public.colaboradores
  add column if not exists troca_senha_obrigatoria boolean not null default true;

-- A migração não pode bloquear retrospectivamente pessoas que já tinham acesso
-- antes deste fluxo existir. A partir daqui, novas contas recebem o default.
update public.colaboradores
set troca_senha_obrigatoria = false;
