import {IEntityDescriptor} from '@kaiju-lib/node-common';
import {SlackConfig} from 'src/entity/slack-config.entity';
import {ENTITY_DESCRIPTOR_MAP} from 'src/util/entity-descriptor';
import {CustomRepository} from 'src/util/typeorm-ex.decorator';
import {Repository} from 'typeorm';

@CustomRepository(SlackConfig)
export class SlackConfigRepository extends Repository<SlackConfig> {
  getRepoEntityName(): string {
    return SlackConfig.name;
  }
  getRepoEntityDescriptor(): IEntityDescriptor {
    return ENTITY_DESCRIPTOR_MAP.get(SlackConfig.name);
  }
}
