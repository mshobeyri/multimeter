import { Parameter } from "../../CommonData";
import { Error } from "./NetworkNodeApi"
export interface Request {
  url?: string;
  protocol?: "http" | "ws";
  format?: "json" | "xml" | "text";
  method?: string;
  headers?: Parameter[];
  cookies?: Parameter[];
  query?: Parameter[];
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

