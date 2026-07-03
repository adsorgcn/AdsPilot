'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Pencil, Loader2 } from 'lucide-react';
import Button from '~/core/ui/Button';

interface EditableCellProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  editable?: boolean;
}

/**
 * Inline editable table cell component
 * Design reference: design.md lines 1924-1938
 */
export function EditableCell({
  value,
  onSave,
  placeholder = '',
  maxLength = 100,
  className = '',
  editable = true,
}: EditableCellProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Reset edit value when prop value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = () => {
    if (!editable) return;
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();

    // Validation
    if (!trimmedValue) {
      setError(t('offers.editableCell.required', 'Value is required'));
      return;
    }

    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('offers.editableCell.saveFailed', 'Save failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!editable) {
    return (
      <div className={`text-sm ${className}`}>
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay to allow button clicks to register
              setTimeout(() => {
                if (isEditing && !isSaving) {
                  handleCancel();
                }
              }, 200);
            }}
            maxLength={maxLength}
            className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSaving}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={handleStartEdit}
      className={`group flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded px-2 py-1 transition-colors ${className}`}
    >
      <span className="text-sm flex-1">
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
