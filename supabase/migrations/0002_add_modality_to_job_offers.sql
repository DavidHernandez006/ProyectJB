-- ============================================================
-- Migración 0002: agrega `modality` a job_offers
--
-- El schema original solo tenía `is_remote` (boolean), lo cual no permite
-- distinguir "híbrido" de "presencial". Este campo se usa en
-- OfertaFiltros / OfertaCardData y en el cálculo de match score.
-- ============================================================

alter table public.job_offers
  add column if not exists modality text
    check (modality in ('presencial', 'remoto', 'hibrido'));

-- Backfill a partir del dato que sí existía
update public.job_offers
  set modality = 'remoto'
  where is_remote = true and modality is null;

update public.job_offers
  set modality = 'presencial'
  where is_remote = false and modality is null;

create index if not exists idx_job_offers_modality on public.job_offers(modality);
