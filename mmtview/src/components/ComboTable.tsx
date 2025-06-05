
interface ComboTablePair {
  name: string;
  options: string[];
  value: string;
}

interface ComboTableProps {
  pairs: ComboTablePair[];
  onChange: (name: string, value: string) => void;
}

const ComboTable: React.FC<ComboTableProps> = ({ pairs, onChange }) => (
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <tbody>
      {pairs.map(pair => (
        <tr key={pair.name}>
          <td style={{ padding: "8px" }}>{pair.name}</td>
          <td style={{ padding: "8px" }}>
            <select
              value={pair.value}
              onChange={e => onChange(pair.name, e.target.value)}
              style={{ width: "100%" }}
            >
              {pair.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default ComboTable;
export type { ComboTablePair, ComboTableProps };