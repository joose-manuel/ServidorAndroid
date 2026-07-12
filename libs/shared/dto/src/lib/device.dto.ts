export interface TriggerNetworkScanDto {
  edgeNodeId: string;
}

export interface WhitelistDeviceDto {
  mac: string;
  hostname?: string;
}

export interface RemoveWhitelistDto {
  mac: string;
}