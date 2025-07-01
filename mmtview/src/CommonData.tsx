export type Type = "var" | "env" | "api" | "test"| null;

export const typeOptions = [
    { value: "api", label: "API" },
    { value: "env", label: "Environment" },
    { value: "var", label: "Variables" },
    { value: "test", label: "Test" }
];