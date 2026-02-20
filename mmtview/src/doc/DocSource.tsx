import React from "react";
import FLEditor from "../components/FLEditor";
import { DocData } from "mmt-core/DocData";
import FieldWithRemove from "../components/FieldWithRemove";

interface DocSourceProps {
  doc: DocData;
  update: (patch: Partial<DocData>) => void;
}

const DocSource: React.FC<DocSourceProps> = ({ doc, update }) => {
  const services = doc.services || [];

  return (
    <div className="panel-form">
      <div className="panel-form-row">
        <FLEditor
          label="Sources"
          value={doc.sources || []}
          onChange={kv => {
            update({ sources: kv });
          }}
          placeholder="file or folder path"
        />
      </div>

      <div className="panel-form-row doc-services">
        <div className="label">Services</div>
        {services.map((svc, idx) => (
          <div key={`service-${idx}`} className="inner-box doc-service-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="label" style={{ paddingTop: 0 }}>Name</div>
            </div>
            <FieldWithRemove
              value={svc?.name || ''}
              placeholder="service name"
              onChange={value => {
                const next = services.slice();
                next[idx] = { ...next[idx], name: value } as any;
                update({ services: next });
              }}
              onRemovePressed={() => {
                const next = services.slice();
                next.splice(idx, 1);
                update({ services: next });
              }}
            />
            <div className="label">Description</div>
            <input
              value={(svc as any)?.description || ''}
              placeholder="service description (optional)"
              onChange={e => {
                const next = services.slice();
                next[idx] = { ...next[idx], description: e.target.value } as any;
                update({ services: next });
              }}
            />
            <FLEditor
              label="Sources"
              value={(svc?.sources || []) as string[]}
              onChange={list => {
                const next = services.slice();
                next[idx] = { ...next[idx], sources: list } as any;
                update({ services: next });
              }}
              placeholder="file or folder path"
            />
          </div>
        ))}
        <button
          onClick={() => {
            const next = services.slice();
            next.push({ name: '', description: '', sources: [] } as any);
            update({ services: next });
          }}
        >
          Add service
        </button>
      </div>
    </div>
  );
};

export default DocSource;
