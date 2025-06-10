import React, { useEffect, useRef, useState } from "react";

interface EndpointInputProps {
  endpoint: string;
  query: Record<string, string>;
  onEndpointChange: (endpoint: string) => void;
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

function buildQueryString(params: Record<string, string> = {}) {
  const entries = Object.entries(params).filter(([k]) => k);
  if (entries.length === 0) return "";
  return (
    "?" +
    entries
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`
      )
      .join("&")
  );
}

const EndpointInput: React.FC<EndpointInputProps> = ({
  endpoint,
  query,
  onEndpointChange,
  onQueryChange
}) => {
  const [inputValue, setInputValue] = useState(endpoint + buildQueryString(query));
  const isUserInput = useRef(false);

  // Only update inputValue from parent if not editing
  useEffect(() => {
    const composed = endpoint + buildQueryString(query);
    if (!isUserInput.current && composed !== inputValue) {
      setInputValue(composed);
    }
    // Reset user input flag after sync
    isUserInput.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, query]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    isUserInput.current = true;
    const [base, ...queryParts] = value.split("?");
    const queryStr = queryParts.join("?");
    onEndpointChange(base); // Always call, let parent decide to update or not
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

export default EndpointInput;