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
    <div style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
      <div className="label">Title</div>
      <div style={{ padding: '5px 0' }}>
        <input
          className="vscode-input"
          value={title || ''}
          onChange={(e) => onChange({ title: e.target.value || undefined })}
          placeholder="title"
          style={{ width: '100%' }}
        />
      </div>

      <div className="label">Tags</div>
      <div style={{ padding: '5px 0' }}>
        <SearchableTagInput
          tags={tags || []}
          onChange={(nextTags) => onChange({ tags: nextTags.length > 0 ? nextTags : undefined })}
          suggestions={tagSuggestions}
        />
      </div>

      <div className="label">Description</div>
      <div style={{ padding: '5px 0', width: '100%' }}>
        <DescriptionEditor
          value={description || ''}
          onChange={(value) => onChange({ description: value || undefined })}
        />
      </div>
    </div>
  );
};

export default FileOverview;