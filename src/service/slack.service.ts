import {HttpService} from '@nestjs/axios';
import {forwardRef, Inject, Injectable} from '@nestjs/common';
import {firstValueFrom} from 'rxjs';

@Injectable()
export class SlackService {
  @Inject(forwardRef(() => HttpService))
  private readonly httpService: HttpService;

  async getUserList(botToken: string) {
    const url = 'https://slack.com/api/users.list';
    const headers = {
      Authorization: 'Bearer ' + botToken,
    };
    const response = await firstValueFrom(this.httpService.get(url, {headers}));
    return response.data;
  }
}
