-- ============================================================
-- FitCheck — setup para foto de cuerpo persistente
-- ============================================================
-- Ejecutar en Supabase Dashboard → SQL Editor → New query.
-- Es IDEMPOTENTE: podés pegarlo y correrlo las veces que quieras.
--
-- NO hace falta crear tabla `profiles` ni trigger: la URL de la foto
-- vive en auth.users.raw_user_meta_data (user_metadata), que el
-- propio usuario puede actualizar con supabase.auth.updateUser().
--
-- Reutilizamos el bucket que ya usa el clóset: `clothing-images`.
-- La nueva foto va en users/<uid>/body/body.jpg (el clóset sigue en
-- users/<uid>/clothing/... y NO se toca).

-- 1) Asegurar que el bucket exista y sea público.
--    (Si ya existe, solo nos aseguramos de que siga público; no
--     sobrescribimos su límite de tamaño ni sus tipos permitidos.)
insert into storage.buckets (id, name, public)
values ('clothing-images', 'clothing-images', true)
on conflict (id) do update
set public = true;

-- 2) Lectura pública: necesario para que getPublicUrl() sirva la imagen
--    en <Image> y en el worker sin pedir un token firmado.
drop policy if exists "fitcheck_storage_read_public" on storage.objects;
create policy "fitcheck_storage_read_public"
on storage.objects for select
to public
using (bucket_id = 'clothing-images');

-- 3) Escritura SOLO dentro de la carpeta del usuario autenticado.
--    Esto cubre TANTO la foto de cuerpo (users/<uid>/body/...) como
--    las prendas del clóset (users/<uid>/clothing/...).
--    Nota: si tenés policies viejas con otros nombres, éstas se SUMAN
--    (no las reemplazan). No hace falta borrar las anteriores.

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

-- 4) Verificación rápida: debe devolver el bucket en público.
-- select id, public from storage.buckets where id = 'clothing-images';
