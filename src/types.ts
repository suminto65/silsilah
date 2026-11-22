export interface Person {
  id: string
  tree_id: string
  full_name: string
  gender: 'L' | 'P' | null
  birth_date: string | null
  death_date: string | null
  address: string | null
  phone: string | null
  photo: string | null
  notes: string | null
  created_at?: string
}
export interface Relation {
  id: string
  tree_id: string
  type: 'parent_of' | 'partner_of'
  a_id: string
  b_id: string
}

export type Role = 'owner' | 'editor' | 'viewer'
export interface Member {
  tree_id: string
  user_id: string
  role: Role
  person_id: string | null
  email: string | null
}
export interface Invite {
  id: string
  token: string
  role: 'editor' | 'viewer'
  max_uses: number
  uses: number
  expires_at: string
  revoked: boolean
}
export interface LogEntry {
  id: number
  user_email: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  table_name: 'persons' | 'relations'
  summary: string | null
  created_at: string
}
export const ROLE_LABEL: Record<Role, string> = { owner: 'Pemilik', editor: 'Editor', viewer: 'Pembaca' }
