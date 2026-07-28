import React from 'react';
import PrimaryButton from '../components/PrimaryButton';

interface FlowchartButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

/** Toolbar control for opening the flow chart view. */
const FlowchartButton: React.FC<FlowchartButtonProps> = ({ disabled, onClick }) => (
  <PrimaryButton
    icon="type-hierarchy-sub"
    disabled={disabled}
    onClick={onClick}
    title="Open flow chart"
  >
    Flow chart
  </PrimaryButton>
);

export default FlowchartButton;
