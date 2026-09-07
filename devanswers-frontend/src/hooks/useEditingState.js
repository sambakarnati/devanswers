import { useState } from 'react';

/**
 * Shared "start edit -> save/cancel" state machine for the inline edit forms
 * on QuestionContent (a single editable question) and AnswerList (one
 * editable answer at a time, keyed by answer id) - factored out so the two
 * components don't each re-implement the same open/close/in-flight logic.
 *
 * `editingKey` identifies what's currently open: pass a fixed truthy value
 * (e.g. `true`) for a single-item form, or an id for a per-row form -
 * `isEditing(key)` then checks whether that particular key is the open one.
 * `isSaving` stays true for the duration of `save()`'s promise so callers
 * can disable Save/Cancel and avoid a double-submit while a request is in
 * flight.
 */
export const useEditingState = () => {
  const [editingKey, setEditingKey] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = (key) => editingKey === key;
  const startEditing = (key) => setEditingKey(key);
  const cancelEditing = () => setEditingKey(null);

  const save = async (performSave) => {
    setIsSaving(true);
    try {
      await performSave();
      setEditingKey(null);
    } finally {
      setIsSaving(false);
    }
  };

  return { isEditing, startEditing, cancelEditing, isSaving, save };
};
