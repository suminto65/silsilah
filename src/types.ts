export interface Person {
  id: string
  tree_id: string
  full_name: string
  gender: 'L' | 'P' | null
  birth_date: string | null
  death_date: string | null
  notes: string | null
}
export interface Relation {
  id: string
  tree_id: string
  type: 'parent_of' | 'partner_of'
  a_id: string
  b_id: string
}
