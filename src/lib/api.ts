import { supabase } from './supabase';

export type Role = 'admin' | 'manager' | 'stylist';

export interface StylistRow {
  id: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  pin?: string;
}

export interface ChecklistRow {
  id: number;
  name: string;
  type: 'station' | 'duty';
  is_active: boolean;
}

export async function listActiveStylists(): Promise<StylistRow[]> {
  const { data, error } = await supabase
    .from('stylists')
    .select('id,full_name,role,is_active')
    .eq('is_active', true)
    .in('role', ['stylist', 'manager'])
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as StylistRow[];
}

export async function pinLogin(fullName: string, pin: string) {
  const { data, error } = await supabase
    .from('stylists')
    .select('id,full_name,role,is_active,pin')
    .eq('full_name', fullName)
    .single();

  if (error) throw error;
  if (!data || !data.is_active) throw new Error('User inactive or not found');
  if (String(data.pin ?? '') !== String(pin)) throw new Error('Invalid PIN');

  return { id: data.id as string, full_name: data.full_name as string, role: data.role as Role };
}

export async function listDutyChecklists(): Promise<ChecklistRow[]> {
  const { data, error } = await supabase
    .from('checklists')
    .select('id,name,type,is_active')
    .eq('is_active', true)
    .eq('type', 'duty')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChecklistRow[];
}

export async function createAssignmentWithStation(params: {
  stylistId: string;
  date: string; // YYYY-MM-DD
  dutyChecklistId: number;
  createdBy: string;
}) {
  const { data, error } = await supabase.rpc('create_daily_assignment_with_station', {
    p_stylist_id: params.stylistId,
    p_assignment_date: params.date,
    p_duty_checklist_id: params.dutyChecklistId,
    p_created_by: params.createdBy,
  });

  if (error) throw error;
  return data as number;
}
