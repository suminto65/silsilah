-- Jalankan di Supabase: SQL Editor > New query > paste > Run
create table trees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table tree_members (
  tree_id uuid references trees on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  primary key (tree_id, user_id)
);

create table persons (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees on delete cascade,
  full_name text not null,
  gender text check (gender in ('L','P')),
  birth_date date,
  death_date date,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create table relations (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees on delete cascade,
  type text not null check (type in ('parent_of','partner_of')), -- parent_of: a = orang tua, b = anak
  a_id uuid not null references persons on delete cascade,
  b_id uuid not null references persons on delete cascade,
  created_by uuid default auth.uid(),
  unique (type, a_id, b_id),
  check (a_id <> b_id)
);

create index on persons (tree_id);
create index on relations (tree_id);

-- Fungsi bantu (security definer agar tidak rekursif pada RLS)
create function is_member(t uuid) returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from tree_members where tree_id = t and user_id = auth.uid()) $$;

create function can_edit(t uuid) returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from tree_members where tree_id = t and user_id = auth.uid() and role in ('owner','editor')) $$;

-- Pembuat pohon otomatis menjadi owner
create function add_owner() returns trigger language plpgsql security definer set search_path = public as
$$ begin insert into tree_members values (new.id, new.created_by, 'owner'); return new; end $$;
create trigger trees_add_owner after insert on trees for each row execute function add_owner();

-- Jejak perubahan
create function touch() returns trigger language plpgsql as
$$ begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;
create trigger persons_touch before update on persons for each row execute function touch();

alter table trees enable row level security;
alter table tree_members enable row level security;
alter table persons enable row level security;
alter table relations enable row level security;

create policy trees_select on trees for select using (is_member(id) or created_by = auth.uid());
create policy trees_insert on trees for insert with check (created_by = auth.uid());
create policy trees_update on trees for update using (can_edit(id));
create policy trees_delete on trees for delete using (exists (select 1 from tree_members m where m.tree_id = id and m.user_id = auth.uid() and m.role = 'owner'));

create policy members_select on tree_members for select using (is_member(tree_id));

create policy persons_select on persons for select using (is_member(tree_id));
create policy persons_insert on persons for insert with check (can_edit(tree_id));
create policy persons_update on persons for update using (can_edit(tree_id));
create policy persons_delete on persons for delete using (can_edit(tree_id));

create policy rel_select on relations for select using (is_member(tree_id));
create policy rel_insert on relations for insert with check (can_edit(tree_id));
create policy rel_delete on relations for delete using (can_edit(tree_id));
