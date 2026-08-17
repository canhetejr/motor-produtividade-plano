-- Área em comum: colaborador pertence a UMA área (área "de casa"), mas
-- algumas demandas precisam de gente de áreas diferentes apontando na mesma
-- tarefa (ex.: um mutirão, um projeto entre times). Até aqui isso era
-- impossível — Kanban e apontamento diário só liberam demanda para quem é
-- da mesma área dela (areaComumDosResponsaveis, lib/demandas-responsaveis.ts;
-- filtro por area_id em app/(app)/apontamento/carregar-apontamento.ts).
--
-- A área não muda de dono: colaborador continua vinculado a uma área só.
-- O que muda é a área marcada `comum = true` liberar as PRÓPRIAS demandas
-- para qualquer colaborador ativo da organização, além de quem já é da área.
alter table public.areas
  add column if not exists comum boolean not null default false;

comment on column public.areas.comum is
  'Área em comum: demandas cadastradas nela ficam disponíveis para apontamento e vínculo no Kanban por colaboradores de QUALQUER área da organização, não só de quem pertence a esta área.';
