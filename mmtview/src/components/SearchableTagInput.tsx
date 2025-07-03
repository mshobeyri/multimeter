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
  placeholder = "tags",
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
    <div
      style={{
        borderRadius: 4,
        padding: 4,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 4,
        background: "var(--vscode-input-background, #1e1e1e)",
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="tag"
          style={{
            borderRadius: 3,
            padding: "2px 8px",
            marginRight: 4,
            display: "flex",
            alignItems: "center",
            background: "var(--vscode-editorWidget-background, #232323)",
            color: "var(--vscode-editorWidget-foreground, #d4d4d4)",
            border: "1px solid var(--vscode-input-border, #3c3c3c)",
          }}
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            style={{
              marginLeft: 4,
              background: "transparent",
              border: "none",
              color: "var(--vscode-button-foreground, #c00)",
              cursor: "pointer",
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
        style={{
          border: "none",
          outline: "none",
          flex: 1,
          minWidth: 80,
          background: "transparent",
          color: "var(--vscode-input-foreground, #d4d4d4)",
        }}
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            background: "var(--vscode-editorWidget-background, #232323)",
            color: "var(--vscode-editorWidget-foreground, #d4d4d4)",
            border: "1px solid var(--vscode-input-border, #3c3c3c)",
            borderRadius: 4,
            marginTop: 32,
            zIndex: 10,
            minWidth: 120,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {filteredSuggestions.map(s => (
            <div
              key={s}
              onMouseDown={() => addTag(s)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                background: "transparent",
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