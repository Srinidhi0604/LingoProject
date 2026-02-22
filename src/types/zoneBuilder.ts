export type ZoneId = string;

export type ZoneLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ZoneSchemaNode = {
  id: ZoneId;
  type: "Zone";
  title: string;
  layout: ZoneLayout;
};

export type ZoneSchema = {
  version: 1;
  routeKey: string;
  nodes: ZoneSchemaNode[];
};

export type ZoneSelection = { zoneId: ZoneId };

export type VoxeraBuilderToParentMessage =
  | { type: "voxera:ready"; routeKey: string; schema: ZoneSchema }
  | { type: "voxera:zoneSelected"; routeKey: string; selection: ZoneSelection | null }
  | { type: "voxera:schemaChanged"; routeKey: string; schema: ZoneSchema };

export type VoxeraParentToBuilderMessage =
  | { type: "voxera:setSchema"; routeKey: string; schema: ZoneSchema }
  | { type: "voxera:setSelection"; routeKey: string; selection: ZoneSelection | null }
  | { type: "voxera:setZoneLayout"; routeKey: string; zoneId: ZoneId; layout: ZoneLayout };
