import React from "react";

type BinaryImagePreviewProps = {
  dataUrl: string;
  alt?: string;
};

const BinaryImagePreview: React.FC<BinaryImagePreviewProps> = ({ dataUrl, alt = "Response image preview" }) => {
  return (
    <div className="apitest-binary-preview">
      <img
        className="apitest-binary-preview-image"
        src={dataUrl}
        alt={alt}
      />
    </div>
  );
};

export default BinaryImagePreview;
