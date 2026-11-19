-- ============================================================
-- FitCheck — guardar looks generados por IA en "Outfits"
-- ============================================================
-- Ejecutar en Supabase Dashboard → SQL Editor → New query.
-- Idempotente: se puede correr varias veces sin errores.
--
-- NO cambia la firma de las pantallas: los outfits armados a mano
-- siguen usando name / item_ids / item_count / item_settings.
-- Agrega solo dos columnas OPCIONALES para los looks de IA.

-- 1) Columnas nuevas en la tabla de outfits.
alter table public.outfits
  add column if not exists image_url text,
  add column if not exists is_ai_generated boolean not null default false;

comment on column public.outfits.image_url is
  'URL pública del PNG generado por el probador IA (incluye marca de agua). NULL en outfits armados a mano.';
comment on column public.outfits.is_ai_generated is
  'true cuando el outfit viene del Probador Virtual.';

-- 2) RLS de outfits: cada usuario ve y toca SOLO los suyos.
--    Si ya tenés policies con otros nombres, estas se SUMAN (OR).
alter table public.outfits enable row level security;

drop policy if exists "fitcheck_outfits_select_own" on public.outfits;
create policy "fitcheck_outfits_select_own"
on public.outfits for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fitcheck_outfits_insert_own" on public.outfits;
create policy "fitcheck_outfits_insert_own"
on public.outfits for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "fitcheck_outfits_update_own" on public.outfits;
create policy "fitcheck_outfits_update_own"
on public.outfits for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "fitcheck_outfits_delete_own" on public.outfits;
create policy "fitcheck_outfits_delete_own"
on public.outfits for delete
to authenticated
using (auth.uid() = user_id);

-- 3) Storage: mismo bucket del clóset y de la foto de cuerpo.
--    La imagen del look va en users/<uid>/outfits/<timestamp>-<random>.png.
--    Estas policies son IDÉNTICAS a las de body_photo_setup.sql, así que
--    correr ambos scripts no genera conflictos.
insert into storage.buckets (id, name, public)
values ('clothing-images', 'clothing-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "fitcheck_storage_read_public" on storage.objects;
create policy "fitcheck_storage_read_public"
on storage.objects for select
to public
using (bucket_id = 'clothing-images');

drop policy if exists "fitcheck_storage_insert_own" on storage.objects;
create policy "fitcheck_storage_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'clothing-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "fitcheck_storage_update_own" on storage.objects;
create policy "fitcheck_storage_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'clothing-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'clothing-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "fitcheck_storage_delete_own" on storage.objects;
create policy "fitcheck_storage_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'clothing-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Verificación rápida:
-- select column_name, data_type from information_schema.columns
-- where table_name = 'outfits' and column_name in ('image_url','is_ai_generated');
