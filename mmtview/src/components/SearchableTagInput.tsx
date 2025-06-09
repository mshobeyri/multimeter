import React, { useState } from "react";

interface SearchableTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

const SearchableTagInput: React.FC<SearchableTagInputProps> = ({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add tag...",
}) => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = suggestions
    .filter(
      (s) =>
        s.toLowerCase().includes(input.toLowerCase()) &&
        !tags.includes(s)
    )
    .slice(0, 8);

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div style={{ minHeight: 38, border: "1px solid #888", borderRadius: 4, padding: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
      {tags.map((tag) => (
        <span key={tag} style={{ background: "#eee", borderRadius: 3, padding: "2px 8px", marginRight: 4, display: "flex", alignItems: "center" }}>
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            style={{
              marginLeft: 4,
              background: "none",
              border: "none",
              color: "#c00",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: 14,
              lineHeight: 1,
            }}
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => {
          setInput(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={e => {
          if (e.key === "Enter" && input.trim()) {
            addTag(input.trim());
          }
          if (e.key === "Escape") {
            setShowSuggestions(false);
          }
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
        placeholder={placeholder}
        style={{ border: "none", outline: "none", flex: 1, minWidth: 80, background: "transparent" }}
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div style={{
          position: "absolute",
          background: "#fff",
          border: "1px solid #ccc",
          borderRadius: 4,
          marginTop: 32,
          zIndex: 10,
          minWidth: 120,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          {filteredSuggestions.map(s => (
            <div
              key={s}
              onMouseDown={() => addTag(s)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                background: "#fff"
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchableTagInput;