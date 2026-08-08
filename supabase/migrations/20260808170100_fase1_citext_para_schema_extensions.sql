-- get_advisors sinalizou citext instalada em public logo após a Fase 1
-- (20260808170000). Padrão do Supabase é manter extensões fora de public;
-- o schema `extensions` já existe neste projeto e já está no search_path
-- padrão, então mover não muda nenhuma referência não qualificada a citext.
alter extension citext set schema extensions;
