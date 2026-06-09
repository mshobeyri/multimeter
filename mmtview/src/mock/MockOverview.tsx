import React from "react";
import { MockData } from "mmt-core/MockData";
import FileOverview from "../shared/FileOverview";
import KSVEditor from "../components/KSVEditor";

interface MockOverviewProps {
  data: MockData;
  updateField: (key: string, value: any) => void;
}

const MockOverview: React.FC<MockOverviewProps> = ({ data, updateField }) => {
  return (
    <>
      <FileOverview
        title={data.title}
        description={data.description}
        tags={data.tags}
        onChange={patch => {
          if ('title' in patch) { updateField('title', patch.title); }
          if ('description' in patch) { updateField('description', patch.description); }
          if ('tags' in patch) { updateField('tags', patch.tags); }
        }}
        tagSuggestions={["users", "auth", "demo", "mock", "api"]}
      />
      <div style={{ paddingLeft: 16, paddingRight: 16 }}>
        <KSVEditor
          label="Import"
          value={data.import}
          onChange={imports => updateField('import', Object.keys(imports).length > 0 ? imports : undefined)}
          keyPlaceholder="alias"
          valuePlaceholder="path"
          filePicker={true}
          filePickerFilters={[
            { name: "Data files", extensions: ["json", "yaml", "yml", "csv"] },
          ]}
        />
      </div>
    </>
  );
};

export default MockOverview;
