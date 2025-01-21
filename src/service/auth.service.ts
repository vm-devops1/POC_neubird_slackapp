import {forwardRef, Inject, Injectable} from '@nestjs/common';
import {SlackConfigDTO} from 'src/dto/slack-config.dto';
import {SlackConfigService} from 'src/service/slack-config.service';
import {copyProperties} from 'src/util/local.util';
import {generateInstallConfigKey} from 'src/util/redis-keys';

@Injectable()
export class AuthService {
  @Inject(forwardRef(() => SlackConfigService))
  private readonly slackConfigService: SlackConfigService;

  saveInstallConfiguration(authInfo: any) {
    const dto = copyProperties(
      {
        key: generateInstallConfigKey(authInfo.team.id),
        value: JSON.stringify(authInfo),
      },
      SlackConfigDTO,
    );
    this.slackConfigService.create(dto);
  }

  async getInstallConfiguration(teamId: string) {
    const config: SlackConfigDTO = await this.slackConfigService.getByKey(generateInstallConfigKey(teamId));
    return config ? JSON.parse(config?.value) : null;
  }

  async deleteInstallConfiguration(teamId: string) {
    this.slackConfigService.deleteByKey(generateInstallConfigKey(teamId));
  }
}
