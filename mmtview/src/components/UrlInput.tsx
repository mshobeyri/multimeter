import React, { useEffect, useRef, useState } from "react";
import { safeList } from "mmt-core/dist/safer";

interface UrlInputProps {
  url: string;
  query: Record<string, string>;
  onUrlChange: (url: string) => void;
  onQueryChange: (query: Record<string, string>) => void;
}

function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!qs) return result;
  const clean = qs.startsWith("?") ? qs.slice(1) : qs;
  for (const pair of clean.split("&")) {
    if (!pair) continue;
    const [k, v] = pair.split("=");
    if (k) result[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
  }
  return result;
}

function buildQueryString(query: Record<string, string> = {}) {
  const entries = Object.entries(query).filter(([k]) => k);
  if (entries.length === 0) return "";
  return (
    "?" +
    safeList(entries)
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`
      )
      .join("&")
  );
}

const UrlInput: React.FC<UrlInputProps> = ({
  url,
  query,
  onUrlChange,
  onQueryChange
}) => {
  const [inputValue, setInputValue] = useState(url + buildQueryString(query));
  const isUserInput = useRef(false);

  // Only update inputValue from parent if not editing
  useEffect(() => {
    const composed = url + buildQueryString(query);
    if (!isUserInput.current && composed !== inputValue) {
      setInputValue(composed);
    }
    // Reset user input flag after sync
    isUserInput.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, query]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    isUserInput.current = true;
    const [base, ...queryParts] = value.split("?");
    const queryStr = queryParts.join("?");
    onUrlChange(base); // Always call, let parent decide to update or not
    onQueryChange(parseQueryString(queryStr));
  };

  return (
    <input
      value={inputValue}
      onChange={handleChange}
      style={{ width: "100%" }}
    />
  );
};

export default UrlInput;