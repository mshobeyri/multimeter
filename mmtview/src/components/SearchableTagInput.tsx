import React, { useState } from "react";
import { safeList } from "mmt-core/safer";

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
    <div className="tag-input">
      {safeList(tags).map((tag) => (
        <span key={tag} className="tag">
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="tag-remove"
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
        className="tag-input-field"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="tag-suggest">
          {safeList(filteredSuggestions).map(s => (
            <div
              key={s}
              onMouseDown={() => addTag(s)}
              className="tag-suggest-item"
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
