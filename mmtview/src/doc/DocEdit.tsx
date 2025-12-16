
import React from "react";
import LEditor from "../components/LEditor";
import { DocData } from "mmt-core/DocData";
import DescriptionEditor from "../components/DescriptionEditor";
import FieldWithRemove from "../components/FieldWithRemove";

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
      <div className="label">Title</div>

      <div style={{ width: "100%", padding: "5px" }}>
        <input
          style={{ width: "100%" }}
          value={doc.title || ""}
          onChange={e => update({ title: e.target.value })}
          placeholder="title"
        />
      </div>

      <div className="label">Description</div>
      <div style={{ width: "100%", padding: "5px" }}>
        <DescriptionEditor
          value={doc.description || ""}
          onChange={value => update({ description: value })}
        />
      </div>

      <LEditor
        label="Sources"
        value={doc.sources || []}
        onChange={kv => {
          update({ sources: kv });
        }}
        placeholder="file or folder path"
      />

      <div className="label">Services</div>
      <div style={{ width: '100%', padding: '5px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(doc.services || []).map((svc, idx) => (
          <div key={idx} style={{ border: '1px solid var(--panel-border)', borderRadius: 6, padding: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <FieldWithRemove
                value={svc?.name || ''}
                placeholder="service name"
                onChange={e => {
                  const next = (doc.services || []).slice();
                  next[idx] = { ...next[idx], name: e } as any;
                  update({ services: next });
                }}
                onRemovePressed={() => {
                  const next = (doc.services || []).slice();
                  next.splice(idx, 1);
                  update({ services: next });
                }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              <input
                style={{ width: '100%' }}
                value={(svc as any)?.description || ''}
                placeholder="service description (optional)"
                onChange={e => {
                  const next = (doc.services || []).slice();
                  next[idx] = { ...next[idx], description: e.target.value } as any;
                  update({ services: next });
                }}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              <LEditor
                label="Sources"
                value={(svc?.sources || []) as string[]}
                onChange={list => {
                  const next = (doc.services || []).slice();
                  next[idx] = { ...next[idx], sources: list } as any;
                  update({ services: next });
                }}
                placeholder="file or folder path"
              />
            </div>
          </div>
        ))}
        <div>
          <button
            onClick={() => {
              const next = (doc.services || []).slice();
              next.push({ name: '', description: '', sources: [] } as any);
              update({ services: next });
            }}
          >
            Add service
          </button>
        </div>
      </div>
    </div >
  );
};

export default DocEdit;