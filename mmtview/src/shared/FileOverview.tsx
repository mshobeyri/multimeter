import React from 'react';
import DescriptionEditor from '../components/DescriptionEditor';
import SearchableTagInput from '../components/SearchableTagInput';

interface FileOverviewProps {
  title?: string;
  description?: string;
  tags?: string[];
  onChange: (patch: { title?: string; description?: string; tags?: string[] }) => void;
  tagSuggestions?: string[];
}

const FileOverview: React.FC<FileOverviewProps> = ({
  title,
  description,
  tags,
  onChange,
  tagSuggestions = [],
}) => {
  return (
    <div className="panel-form file-overview">
      <div className="panel-form-row">
        <div className="label">Title</div>
        <input
          className="vscode-input"
          value={title || ''}
          onChange={(e) => onChange({ title: e.target.value || undefined })}
          placeholder="title"
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Tags</div>
        <SearchableTagInput
          tags={tags || []}
          onChange={(nextTags) => onChange({ tags: nextTags.length > 0 ? nextTags : undefined })}
          suggestions={tagSuggestions}
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Description</div>
        <DescriptionEditor
          value={description || ''}
          onChange={(value) => onChange({ description: value || undefined })}
        />
      </div>
    </div>
  );
};

export default FileOverview;
