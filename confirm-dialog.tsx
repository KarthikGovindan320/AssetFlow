import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '../api/client';

export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: string[],
): boolean {
  if (error instanceof ApiError) {
    const fields = error.fieldErrors;
    const entries = Object.entries(fields);
    if (entries.length > 0) {
      let allInline = true;
      for (const [field, message] of entries) {
        if (knownFields.includes(field)) {
          setError(field as Path<T>, { type: 'server', message });
        } else {
          allInline = false;
        }
      }
      if (!allInline) toast.error(error.message);
      return true;
    }
    toast.error(error.message);
    return false;
  }
  toast.error('Something went wrong. Please try again.');
  return false;
}

export function toastApiError(error: unknown) {
  if (error instanceof ApiError) toast.error(error.message);
  else toast.error('Something went wrong. Please try again.');
}
