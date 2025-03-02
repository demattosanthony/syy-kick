import { FragmentIdMap, FragmentsGroup } from "@thatopen/fragments";

export interface MaterialLayer {
  thickness: number;
  materialName: string;
}

export interface MaterialData {
  type: string;
  name?: string;
  layers?: MaterialLayer[];
  materials?: string[];
}

export interface Property {
  name: string;
  value: any;
  type?: number;
  valueType?: string;
  unit?: string;
}

export interface PropertySet {
  name: string;
  properties: Property[];
}

export interface QuantitySet {
  name: string;
  quantities: Property[];
}

export interface IFCModel {
  name: string;
  content: File;
  fragmentsGroup: FragmentsGroup;
  tree: EntityNode | null;
}

export interface IFCCategory {
  name: string;
  fragIds: Record<string, FragmentIdMap>; // Fragment Ids for each model
}

export interface ElementAttributes {
  [key: string]: {
    value?: any;
    type?: number;
    valueType?: string;
    unit?: string;
  };
}

export interface EntityNode {
  expressID: number;
  ifcClass: string; // Updated to store the IFC class
  name: string;
  children: EntityNode[];
  psets?: PropertySet[];
  qsets?: QuantitySet[];
  materials?: MaterialData[];
  attributes?: ElementAttributes; // Added to include comprehensive attributes
}
