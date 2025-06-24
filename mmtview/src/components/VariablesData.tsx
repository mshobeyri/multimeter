
import {Type} from "./CommonData"

export interface Variable {
    key: string;
    type: string;
    name?: string;
    info?: string;
    value?: string;
    alter_name?: string;
    Alter_Name?: string;
    ALTER_NAME?: string;
    AlterName?: string;
    altername?: string;
    alterName?: string;
    protobuf?: string;
    fields?: Record<string, string>;
}

export type Variables = Variable[];

export interface VariablesData {
    type: Type;
    variables: Variables;
}