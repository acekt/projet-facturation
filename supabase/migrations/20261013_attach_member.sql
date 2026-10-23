-- =============================================================================
-- Rattache un compte (opérateur/admin) créé depuis le Desktop au tenant de l'admin appelant.
-- À exécuter dans Supabase > SQL Editor.
-- =============================================================================

-- 1. Assouplissement de la contrainte de rôle pour accepter 'user' et 'operateur'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (lower(role) in ('superadmin', 'super_admin', 'admin', 'user', 'operateur', 'operator'));

-- 2. Fonction attach_member
create or replace function public.attach_member(
  p_user_id uuid,
  p_role text default 'user',
  p_full_name text default null,
  p_phone text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller_role text;
  v_tenant public.profiles.tenant_id%type;
  v_target_tenant text;
  v_email text;
  v_role text := case when lower(coalesce(p_role, '')) = 'admin' then 'admin' else 'user' end;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select lower(role), tenant_id into v_caller_role, v_tenant from public.profiles where id = auth.uid();
  if v_caller_role is distinct from 'admin' or v_tenant is null then
    raise exception 'forbidden: admin only';
  end if;

  select tenant_id::text into v_target_tenant from public.profiles where id = p_user_id;
  if v_target_tenant is not null and v_target_tenant <> v_tenant::text then
    raise exception 'user belongs to another tenant';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'unknown user'; end if;

  insert into public.profiles (id, tenant_id, email, role, full_name, phone)
    values (p_user_id, v_tenant, v_email, v_role, p_full_name, p_phone)
  on conflict (id) do update
    set tenant_id = excluded.tenant_id,
        role = excluded.role,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone);
end $$;

revoke all on function public.attach_member(uuid, text, text, text) from public;
grant execute on function public.attach_member(uuid, text, text, text) to authenticated;
