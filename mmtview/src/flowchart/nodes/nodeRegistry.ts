import FlowNodeCard from './FlowNodeCard';

/**
 * All kinds share the same card renderer; styling is driven by the `kind`
 * field on the node's data. This keeps node markup centralized.
 */
export const nodeTypes = {
  flowCard: FlowNodeCard,
};
