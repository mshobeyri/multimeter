import React from "react";
import { RequestFormat } from "mmt-core/CommonData";
import {
  BodyFormatSelect,
  REQUEST_BODY_FORMAT_MENU,
} from "./BodyFormatControls";

type BodyFormatBarProps = {
  value: RequestFormat;
  onChange: (format: RequestFormat) => void;
};

const BodyFormatBar: React.FC<BodyFormatBarProps> = ({ value, onChange }) => {
  return (
    <div className="apitest-body-format-bar" aria-label="Body format">
      <BodyFormatSelect
        value={value}
        menu={REQUEST_BODY_FORMAT_MENU}
        onChange={onChange}
        ariaLabel="Body format"
      />
    </div>
  );
};

export default BodyFormatBar;
