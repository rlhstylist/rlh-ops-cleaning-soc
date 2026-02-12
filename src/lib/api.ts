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

export interface SessionUser {
  id: string;
  full_name: string;
  role: Role;
}

export type StaffMember = StylistRow;

export interface StylistTask {
  completion_id: number;
  checklist_name: string;
  section: string;
  task_name: string;
  sort_order: number;
  completed_at: string | null;
}

export function todayISODate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
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

export async function pinLogin(fullName: string, pin: string): Promise<SessionUser> {
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

export async function getTodayTasksForStylist(params: {
  stylist_id: string;
  assignment_date?: string;
}): Promise<{ assignment_id: number | null; tasks: StylistTask[] }> {
  const assignmentDate = params.assignment_date ?? todayISODate();

  const { data: assignment, error: assignmentError } = await supabase
    .from('daily_assignments')
    .select('id')
    .eq('stylist_id', params.stylist_id)
    .eq('assignment_date', assignmentDate)
    .maybeSingle();

  if (assignmentError) throw assignmentError;
  if (!assignment) {
    return { assignment_id: null, tasks: [] };
  }

  const { data: completions, error: completionsError } = await supabase
    .from('task_completions')
    .select(
      `
        id,
        completed_at,
        daily_assignment_checklist:daily_assignment_checklists!inner(
          assignment_id,
          checklist_task:checklist_tasks!inner(
            name,
            section,
            sort_order,
            checklist:checklists!inner(name)
          )
        )
      `,
    )
    .eq('daily_assignment_checklists.assignment_id', assignment.id);

  if (completionsError) throw completionsError;

  const tasks = (completions ?? [])
    .map((completion: any) => ({
      completion_id: completion.id as number,
      checklist_name: completion.daily_assignment_checklist?.checklist_task?.checklist?.name as string,
      section: (completion.daily_assignment_checklist?.checklist_task?.section as string) || 'General',
      task_name: completion.daily_assignment_checklist?.checklist_task?.name as string,
      sort_order: Number(completion.daily_assignment_checklist?.checklist_task?.sort_order ?? 0),
      completed_at: (completion.completed_at as string | null) ?? null,
    }))
    .sort((a, b) => {
      const checklistCmp = a.checklist_name.localeCompare(b.checklist_name);
      if (checklistCmp !== 0) return checklistCmp;
      const sectionCmp = a.section.localeCompare(b.section);
      if (sectionCmp !== 0) return sectionCmp;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.task_name.localeCompare(b.task_name);
    });

  return { assignment_id: assignment.id as number, tasks };
}

export async function setTaskCompletion(params: { completion_id: number; completed: boolean }) {
  const completedAt = params.completed ? new Date().toISOString() : null;
  const { error } = await supabase
    .from('task_completions')
    .update({ completed_at: completedAt })
    .eq('id', params.completion_id);

  if (error) throw error;
}
