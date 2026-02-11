import { supabaseRpc, supabaseSelect } from './supabase'

export type Role = 'stylist' | 'manager' | 'admin'

export interface StaffMember {
  id: string
  full_name: string
  role: Role
  is_active: boolean
}

export interface DutyChecklist {
  id: number
  name: string
  type: 'duty' | 'station'
}

export interface SessionUser {
  id: string
  full_name: string
  role: Role
}

export async function listActiveStylists(): Promise<StaffMember[]> {
  const query = new URLSearchParams({
    select: 'id,full_name,role,is_active',
    is_active: 'eq.true',
    role: 'in.(stylist,manager)',
    order: 'full_name.asc',
  })

  return supabaseSelect<StaffMember>('staff', query.toString())
}

export async function pinLogin(fullName: string, pin: string): Promise<SessionUser | null> {
  try {
    const response = await supabaseRpc<SessionUser | SessionUser[] | null>('pin_login', {
      p_full_name: fullName,
      p_pin: pin,
    })

    if (!response) {
      return null
    }

    return Array.isArray(response) ? response[0] ?? null : response
  } catch {
    const query = new URLSearchParams({
      select: 'id,full_name,role',
      full_name: `eq.${fullName}`,
      pin: `eq.${pin}`,
      is_active: 'eq.true',
      limit: '1',
    })

    const users = await supabaseSelect<SessionUser>('staff', query.toString())
    return users[0] ?? null
  }
}

export async function listDutyChecklists(): Promise<DutyChecklist[]> {
  const query = new URLSearchParams({
    select: 'id,name,type',
    type: 'eq.duty',
    order: 'name.asc',
  })

  return supabaseSelect<DutyChecklist>('checklists', query.toString())
}

interface CreateAssignmentInput {
  stylistId: string
  date: string
  dutyChecklistId: number
  createdBy: string
}

export async function createAssignmentWithStation(input: CreateAssignmentInput): Promise<void> {
  await supabaseRpc<unknown>('create_daily_assignment_with_station', {
    stylist_id: input.stylistId,
    assignment_date: input.date,
    duty_checklist_id: input.dutyChecklistId,
    created_by: input.createdBy,
  })
}
