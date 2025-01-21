import {forwardRef, Inject, Injectable} from '@nestjs/common';
import {SlackConfigDTO} from 'src/dto/slack-config.dto';
import {KVService} from 'src/service/kv.service';
import {SlackConfigService} from 'src/service/slack-config.service';
import {SLACK_REDIS_KEYS} from 'src/util/constant';
import {copyProperties} from 'src/util/local.util';
import {
  generateChannelMetaDataKey,
  generateConfigKey,
  generateDirectMessageMetaDataKey,
  generateDirectMessageThreadProjectMappingKey,
  generateThreadProjectMappingKey,
} from 'src/util/redis-keys';
import {Transactional} from 'typeorm-transactional';

interface CONFIG {
  url: string;
  apiKey: string;
}
@Injectable()
export class MasterDataService {
  @Inject(forwardRef(() => KVService))
  private readonly kvService: KVService;

  @Inject(forwardRef(() => SlackConfigService))
  private readonly slackConfigService: SlackConfigService;

  async saveConfig(teamId: any, data: CONFIG) {
    const dto = copyProperties(
      {
        key: generateConfigKey(teamId),
        value: JSON.stringify(data),
      },
      SlackConfigDTO,
    );
    return await this.slackConfigService.create(dto);
  }

  async updateConfig(teamId: any, data: CONFIG) {
    const dto = copyProperties(
      {
        key: generateConfigKey(teamId),
        value: JSON.stringify(data),
      },
      SlackConfigDTO,
    );
    return await this.slackConfigService.update(dto);
  }

  async deleteConfig(teamId: any) {
    return await this.slackConfigService.deleteByKey(generateConfigKey(teamId));
  }

  async getConfig(teamId: any): Promise<any> {
    const config: SlackConfigDTO = await this.slackConfigService.getByKey(generateConfigKey(teamId));

    return config ? JSON.parse(config.value) : null;
  }

  @Transactional()
  async saveChannelData(data: any, isDirectMessage: boolean) {
    const {teamId, channelId, projectId, sessionId, projectName, sessionName, requestId} = data;
    const obj = {projectId, projectName, sessionId, sessionName, requestId};

    const key = isDirectMessage
      ? generateDirectMessageMetaDataKey(teamId, channelId)
      : generateChannelMetaDataKey(teamId, channelId);
    const dto = copyProperties(
      {
        key,
        value: JSON.stringify(obj),
      },
      SlackConfigDTO,
    );

    await this.slackConfigService.update(dto);
  }

  @Transactional()
  async saveThreadData(data: any, isDirectMessage: boolean) {
    const {teamId, channelId, projectId, sessionId, projectName, sessionName, requestId, threadId} = data;

    const obj = {projectId, projectName, sessionId, sessionName, requestId};

    const key = isDirectMessage
      ? generateDirectMessageThreadProjectMappingKey(teamId, channelId, threadId)
      : generateThreadProjectMappingKey(teamId, channelId, threadId);
    const dto = copyProperties(
      {
        key,
        value: JSON.stringify(obj),
      },
      SlackConfigDTO,
    );

    await this.slackConfigService.update(dto);
  }

  async getChannelData(teamId: string, channelId: string) {
    console.log('getChannelMetadata>>', teamId, channelId);
    const config: SlackConfigDTO = await this.slackConfigService.getByKey(
      generateChannelMetaDataKey(teamId, channelId),
    );
    console.log('config:>>', config);
    if (!config) {
      return null;
    } else {
      return JSON.parse(config.value);
    }
  }

  async getDirectMessageData(teamId: string, channelId: string) {
    const config: SlackConfigDTO = await this.slackConfigService.getByKey(
      generateDirectMessageMetaDataKey(teamId, channelId),
    );
    console.log('config:>>', config);
    if (!config) {
      return null;
    } else {
      return JSON.parse(config.value);
    }
  }

  async getThreadData(teamId: string, channelId: string, threadId: string, isDirectMessage: boolean) {
    const key = isDirectMessage
      ? generateDirectMessageThreadProjectMappingKey(teamId, channelId, threadId)
      : generateThreadProjectMappingKey(teamId, channelId, threadId);

    const config: SlackConfigDTO = await this.slackConfigService.getByKey(key);

    if (!config) {
      return null;
    } else {
      return JSON.parse(config.value);
    }
  }

  async deleteAllRowsByTeamId(teamId: string) {
    await this.slackConfigService.deleteByTeamId(teamId);
  }
}
