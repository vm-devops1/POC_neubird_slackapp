import {SLACK_REDIS_KEYS} from 'src/util/constant';

export const generateInstallConfigKey = (teamId: string) => {
  return `T_${teamId}:${SLACK_REDIS_KEYS.INSTALL_INFORMATION}`;
};

export const generateConfigKey = (teamId: string) => {
  return `T_${teamId}:${SLACK_REDIS_KEYS.CONFIG}`;
};

export const generateChannelMetaDataKey = (teamId: string, channelId: string) => {
  return `T_${teamId}:C_${channelId}:${SLACK_REDIS_KEYS.CHANEL_META_DATA}`;
};

export const generateThreadProjectMappingKey = (teamId: string, channelId: string, threadId: string) => {
  return `T_${teamId}:C_${channelId}:TH_${threadId}:${SLACK_REDIS_KEYS.THREAD_PROJECT_MAPPING}`;
};

export const generateDirectMessageMetaDataKey = (teamId: string, channelId: string) => {
  return `T_${teamId}:DM_${channelId}:${SLACK_REDIS_KEYS.DIRECT_MESSAGE_META_DATA}`;
};

export const generateDirectMessageThreadProjectMappingKey = (teamId: string, channelId: string, threadId: string) => {
  return `T_${teamId}:DM_${channelId}:TH_${threadId}:${SLACK_REDIS_KEYS.DIRECT_MESSAGE_THREAD_PROJECT_MAPPING}`;
};
