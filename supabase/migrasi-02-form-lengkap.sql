-- Untuk database yang SUDAH berjalan (Tahap 1). Jalankan sekali di SQL Editor.
alter table persons
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists photo text,
  add column if not exists created_at timestamptz not null default now();

-- Titik pusat tampilan ("Saya") untuk setiap pohon
alter table trees
  add column if not exists root_person_id uuid references persons on delete set null;
