import React from "react";

type SectionEditLabelProps = {
  label: string;
  editing: boolean;
  onEdit: () => void;
  /** Tooltip when entering edit mode. */
  editTitle?: string;
};

/**
 * Section header with a pencil right after the title that enters edit mode.
 * Use `SectionEditDone` under the fields to leave edit mode.
 */
export const SectionEditLabel: React.FC<SectionEditLabelProps> = ({
  label,
  editing,
  onEdit,
  editTitle = `Edit ${label}`,
}) => (
  <div className="label section-edit-label">
    <span>{label}</span>
    {!editing ? (
      <button
        type="button"
        className="button-icon no-shrink section-edit-toggle"
        onClick={onEdit}
        title={editTitle}
        aria-label={editTitle}
      >
        <span className="codicon codicon-edit" aria-hidden />
      </button>
    ) : null}
  </div>
);

type SectionEditDoneProps = {
  onDone: () => void;
  label?: string;
};

/** Check + Done control placed under edited fields to leave edit mode. */
export const SectionEditDone: React.FC<SectionEditDoneProps> = ({
  onDone,
  label = "Done",
}) => (
  <div className="section-edit-done-row">
    <button
      type="button"
      className="section-edit-done"
      onClick={onDone}
      title={label}
      aria-label={label}
    >
      <span className="codicon codicon-check" aria-hidden />
      {label}
    </button>
  </div>
);

export default SectionEditLabel;
