
import React from "react";
import LEditor from "../components/LEditor";
import { DocData } from "mmt-core/DocData";
import DescriptionEditor from "../components/DescriptionEditor";

interface DocEditProps {
  doc: DocData;
  update: (patch: Partial<DocData>) => void;
}

const DocEdit: React.FC<DocEditProps> = ({ doc, update }) => {
  return (
    <div
      className="DocEdit"
      style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
    >
      <div className="label">title</div>

      <div style={{ width: "100%", padding: "5px" }}>
        <input
          style={{ width: "100%" }}
          value={doc.title || ""}
          onChange={e => update({ title: e.target.value })}
          placeholder="title"
        />
      </div>

      <div className="label">description</div>
      <div style={{ width: "100%", padding: "5px" }}>
        <DescriptionEditor
          value={doc.description || ""}
          onChange={value => update({ description: value })}
        />
      </div>

      <LEditor
        label="sources"
        value={doc.sources || []} 
        onChange={kv => {
          update({ sources: kv });
        }}
        placeholder="file or folder path"
      />
    </div >
  );
};

export default DocEdit;