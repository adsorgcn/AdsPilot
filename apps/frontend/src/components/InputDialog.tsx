'use client';

import { useState, type ChangeEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';

interface InputField {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: 'text' | 'number';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: InputField[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (values: Record<string, string>) => void | Promise<void>;
}

export default function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
}: InputDialogProps) {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach((field) => {
      initial[field.name] = field.defaultValue || '';
    });
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = (field: InputField, value: string): string | null => {
    if (field.required && !value.trim()) {
      return `${field.label} is required`;
    }

    if (field.minLength && value.length < field.minLength) {
      return `${field.label} must be at least ${field.minLength} characters`;
    }

    if (field.maxLength && value.length > field.maxLength) {
      return `${field.label} must be at most ${field.maxLength} characters`;
    }

    if (field.type === 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        return `${field.label} must be a valid number`;
      }
      if (field.min !== undefined && num < field.min) {
        return `${field.label} must be at least ${field.min}`;
      }
      if (field.max !== undefined && num > field.max) {
        return `${field.label} must be at most ${field.max}`;
      }
    }

    return null;
  };

  const handleConfirm = async () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const error = validateField(field, values[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await onConfirm(values);
      onOpenChange(false);
      // Reset form
      const initial: Record<string, string> = {};
      fields.forEach((field) => {
        initial[field.name] = field.defaultValue || '';
      });
      setValues(initial);
      setErrors({});
    } catch (error) {
      // Error handled by caller
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <TextFieldLabel>
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </TextFieldLabel>
              <TextFieldInput
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={values[field.name]}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange(field.name, event.currentTarget.value)
                }
                disabled={loading}
              />
              {errors[field.name] && (
                <p className="text-sm text-red-600">{errors[field.name]}</p>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button onClick={handleConfirm} disabled={loading} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
