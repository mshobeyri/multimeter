import React from "react";
import { MockData } from "mmt-core/MockData";
import FileOverview from "../shared/FileOverview";

interface MockOverviewProps {
  data: MockData;
  updateField: (key: string, value: any) => void;
}

const MockOverview: React.FC<MockOverviewProps> = ({ data, updateField }) => {
  return (
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
  );
};

export default MockOverview;
