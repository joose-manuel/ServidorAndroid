export interface RebootModemRequestDto {
  reason?: string;
}

export interface CreateCronJobDto {
  cron: string;
  timezone: string;
  action: 'reboot';
  enabled: boolean;
}

export interface UpdateCronJobDto extends Partial<CreateCronJobDto> {}

export interface ModemCommandRequestDto {
  command: string;
  args?: Record<string, unknown>;
}