-- TAHAP 2: undangan keluarga, peran, pusat per pengguna, riwayat perubahan.
-- Jalankan SEKALI di Supabase SQL Editor (setelah schema.sql / migrasi-02).

-- 1) Anggota: kartu "Saya" milik masing-masing anggota + email
alter table tree_members
  add column if not exists person_id uuid references persons on delete set null,
  add column if not exists email text,
  add column if not exists joined_at timestamptz not null default now();

update tree_members m set email = u.email from auth.users u where u.id = m.user_id and m.email is null;
update tree_members m set person_id = t.root_person_id
  from trees t where t.id = m.tree_id and m.role = 'owner' and m.person_id is null;

create or replace function add_owner() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into tree_members (tree_id, user_id, role, email)
  values (new.id, new.created_by, 'owner', (select email from auth.users where id = new.created_by));
  return new;
end $$;

create or replace function is_owner(t uuid) returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from tree_members where tree_id = t and user_id = auth.uid() and role = 'owner') $$;

-- 2) Undangan
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  role text not null check (role in ('editor','viewer')),
  max_uses int not null default 10,
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table invites enable row level security;
drop policy if exists invites_owner on invites;
create policy invites_owner on invites for all
  using (is_owner(tree_id)) with check (is_owner(tree_id) and created_by = auth.uid());

create or replace function invite_info(p_token text)
returns table (tree_name text, role text, valid boolean)
language sql security definer set search_path = public as
$$ select t.name, i.role, (not i.revoked and i.expires_at > now() and i.uses < i.max_uses)
   from invites i join trees t on t.id = i.tree_id where i.token = p_token $$;

create or replace function accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as
$$ declare inv invites;
begin
  if auth.uid() is null then raise exception 'Silakan masuk dulu.'; end if;
  select * into inv from invites where token = p_token for update;
  if not found or inv.revoked or inv.expires_at <= now() or inv.uses >= inv.max_uses then
    raise exception 'Tautan undangan tidak berlaku (kedaluwarsa, dicabut, atau sudah penuh).';
  end if;
  if exists (select 1 from tree_members where tree_id = inv.tree_id and user_id = auth.uid()) then
    return inv.tree_id;
  end if;
  insert into tree_members (tree_id, user_id, role, email)
  values (inv.tree_id, auth.uid(), inv.role, (select email from auth.users where id = auth.uid()));
  update invites set uses = uses + 1 where id = inv.id;
  return inv.tree_id;
end $$;

-- 3) Kelola anggota (lewat fungsi agar aman)
create or replace function set_my_person(p_tree uuid, p_person uuid) returns void
language plpgsql security definer set search_path = public as
$$ begin
  if p_person is not null and not exists (select 1 from persons where id = p_person and tree_id = p_tree) then
    raise exception 'Orang tersebut tidak ada di pohon ini.';
  end if;
  update tree_members set person_id = p_person where tree_id = p_tree and user_id = auth.uid();
end $$;

create or replace function set_member_role(p_tree uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as
$$ begin
  if not is_owner(p_tree) then raise exception 'Hanya pemilik yang dapat mengubah peran.'; end if;
  if p_role not in ('editor','viewer') then raise exception 'Peran tidak valid.'; end if;
  update tree_members set role = p_role where tree_id = p_tree and user_id = p_user and role <> 'owner';
end $$;

create or replace function remove_member(p_tree uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as
$$ begin
  if is_owner(p_tree) or p_user = auth.uid() then
    delete from tree_members where tree_id = p_tree and user_id = p_user and role <> 'owner';
  else
    raise exception 'Tidak berhak.';
  end if;
end $$;

-- 4) Riwayat perubahan
create table if not exists change_log (
  id bigserial primary key,
  tree_id uuid not null,
  user_id uuid default auth.uid(),
  user_email text,
  action text not null,
  table_name text not null,
  record_id uuid,
  summary text,
  old_data jsonb,
  new_data jsonb,
  txid bigint default txid_current(),
  created_at timestamptz not null default now()
);
create index if not exists change_log_tree_idx on change_log (tree_id, id desc);
alter table change_log enable row level security;
drop policy if exists log_select on change_log;
create policy log_select on change_log for select using (is_member(tree_id));

create or replace function log_change() returns trigger language plpgsql security definer set search_path = public as
$$ declare r record; v_sum text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at' - 'updated_by') = (to_jsonb(new) - 'updated_at' - 'updated_by') then
    return new;
  end if;
  if tg_table_name = 'persons' then
    v_sum := r.full_name;
  else
    v_sum := coalesce((select full_name from persons where id = r.a_id), '?')
      || case r.type when 'parent_of' then ' → orang tua dari ' else ' ↔ pasangan ' end
      || coalesce((select full_name from persons where id = r.b_id), '?');
  end if;
  insert into change_log (tree_id, user_email, action, table_name, record_id, summary, old_data, new_data)
  values (r.tree_id, (select email from auth.users where id = auth.uid()), tg_op, tg_table_name, r.id, v_sum,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'photo' end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) - 'photo' end);
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists persons_log on persons;
create trigger persons_log after insert or update or delete on persons for each row execute function log_change();
drop trigger if exists relations_log on relations;
create trigger relations_log after insert or delete on relations for each row execute function log_change();

-- Pulihkan orang yang terhapus (beserta hubungannya; foto tidak ikut pulih)
create or replace function restore_person(p_log bigint) returns void
language plpgsql security definer set search_path = public as
$$ declare l change_log; p persons;
begin
  select * into l from change_log where id = p_log and table_name = 'persons' and action = 'DELETE';
  if not found then raise exception 'Catatan tidak ditemukan.'; end if;
  if not can_edit(l.tree_id) then raise exception 'Tidak berhak.'; end if;
  if exists (select 1 from persons where id = l.record_id) then return; end if;
  p := jsonb_populate_record(null::persons, l.old_data);
  insert into persons select (p).*;
  insert into relations (id, tree_id, type, a_id, b_id)
  select (x.old_data->>'id')::uuid, (x.old_data->>'tree_id')::uuid, x.old_data->>'type',
         (x.old_data->>'a_id')::uuid, (x.old_data->>'b_id')::uuid
  from change_log x
  where x.txid = l.txid and x.table_name = 'relations' and x.action = 'DELETE'
    and exists (select 1 from persons where id = (x.old_data->>'a_id')::uuid)
    and exists (select 1 from persons where id = (x.old_data->>'b_id')::uuid)
  on conflict do nothing;
end $$;

-- 5) Hak akses fungsi: hanya pengguna yang sudah masuk
revoke execute on function accept_invite(text), invite_info(text), set_my_person(uuid, uuid),
  set_member_role(uuid, uuid, text), remove_member(uuid, uuid), restore_person(bigint) from public, anon;
grant execute on function accept_invite(text), invite_info(text), set_my_person(uuid, uuid),
  set_member_role(uuid, uuid, text), remove_member(uuid, uuid), restore_person(bigint) to authenticated;

-- 6) Pembaruan langsung (realtime) saat anggota lain mengubah data
do $$ begin
  begin alter publication supabase_realtime add table persons; exception when others then null; end;
  begin alter publication supabase_realtime add table relations; exception when others then null; end;
end $$;
