import { InstallmentContract, PromissoryNote } from '../types/installment';

export const STORAGE_KEY_INSTALLMENTS = 'alpha_accounting_installments_v1';
export const STORAGE_KEY_PROMISSORY_NOTES = 'alpha_accounting_promissory_notes_v1';

export const INITIAL_INSTALLMENT_CONTRACTS: InstallmentContract[] = [];

export const INITIAL_PROMISSORY_NOTES: PromissoryNote[] = [];

export function getStoredInstallments(): InstallmentContract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INSTALLMENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse installments storage', e);
  }
  return INITIAL_INSTALLMENT_CONTRACTS;
}

export function saveStoredInstallments(contracts: InstallmentContract[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_INSTALLMENTS, JSON.stringify(contracts));
    window.dispatchEvent(new Event('alpha-installments-updated'));
  } catch (e) {
    console.error('Failed to save installments', e);
  }
}

export function getStoredPromissoryNotes(): PromissoryNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROMISSORY_NOTES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse promissory notes storage', e);
  }
  return INITIAL_PROMISSORY_NOTES;
}

export function saveStoredPromissoryNotes(notes: PromissoryNote[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROMISSORY_NOTES, JSON.stringify(notes));
    window.dispatchEvent(new Event('alpha-promissory-notes-updated'));
  } catch (e) {
    console.error('Failed to save promissory notes', e);
  }
}
