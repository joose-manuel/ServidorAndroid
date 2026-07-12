export interface AlertsQueryDto {
  edgeNodeId?: string;
  severity?: 'info' | 'warning' | 'critical';
  acknowledged?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AcknowledgeAlertDto {
  alertId: string;
}