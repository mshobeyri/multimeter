import { Parameter } from "../../CommonData";
import { Error } from "./NetworkNodeApi"
export interface Request {
  url?: string;
  protocol?: "http" | "ws";
  format?: "json" | "xml" | "text";
  method?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}

export interface NetworkAPI {
  // Common
  send: () => Promise<void>;
  requestData?: Request;
  setRequestData: (data: Request) => void;
  responseBody?: any;
  loading: boolean;
  error: Error | null;
  duration: number;
  cancel: () => Promise<void>;

  // HTTP
  responseHeaders?: Record<string, string>;
  responseCookies?: Record<string, string>;
  statusCode?: number | null;

  // WebSocket 
  connectWs: () => void;
  connecting: boolean;
  connected: boolean;
  closeWs: () => void;
  clearRespond: () => void;
}

