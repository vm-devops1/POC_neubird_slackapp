import {forwardRef, Inject, Injectable} from '@nestjs/common';
import {SlackConfigDTO} from 'src/dto/slack-config.dto';
import {SlackConfig} from 'src/entity/slack-config.entity';
import {SlackConfigRepository} from 'src/repository/slack-config.repository';
import {copyProperties} from 'src/util/local.util';
import {Transactional} from 'typeorm-transactional';

@Injectable()
export class SlackConfigService {
  @Inject(forwardRef(() => SlackConfigRepository))
  private readonly repository: SlackConfigRepository;

  @Transactional()
  async create(dto: SlackConfigDTO): Promise<SlackConfig> {
    let entity = copyProperties(dto, SlackConfig);
    return this.repository.save(entity);
  }

  @Transactional()
  async update(dto: SlackConfigDTO): Promise<SlackConfig> {
    const existingConfig = await this.repository
      .createQueryBuilder('slack_config')
      .where('slack_config.key = :key', {key: dto.key})
      .getOne();

    if (existingConfig) {
      // Update existing record
      const updatedEntity = copyProperties(dto, SlackConfig);

      updatedEntity.id = existingConfig.id;

      return this.repository.save(updatedEntity);
    } else {
      // If no existing record, create a new one
      let entity = copyProperties(dto, SlackConfig);
      return this.repository.save(entity);
    }
  }

  async getByKey(key: string): Promise<SlackConfig> {
    return this.repository.createQueryBuilder('slack_config').where('slack_config.key = :key', {key}).getOne();
  }

  @Transactional()
  async deleteByKey(key: string): Promise<void> {
    await this.repository.createQueryBuilder('slack_config').delete().where('slack_config.key = :key', {key}).execute();
  }

  @Transactional()
  async deleteByTeamId(teamId: string): Promise<string[]> {
    const matchingKeys = await this.repository
      .createQueryBuilder('slack_config')
      .select('slack_config.key')
      .where('slack_config.key LIKE :pattern', {pattern: `T_${teamId}%`})
      .getMany();

    const keys = matchingKeys.map(config => config.key);

    if (keys.length > 0) {
      await this.repository
        .createQueryBuilder()
        .delete()
        .from('slack_config')
        .where('key LIKE :pattern', {pattern: `T_${teamId}%`})
        .execute();
    }
    return keys;
  }
}
