import {Public} from '@kaiju-lib/node-common';
import {Body, Controller, forwardRef, Get, Inject, Post, Request, Response} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {AuthService} from 'src/service/auth.service';
import {EventService} from 'src/service/event.service';
import {SLACK_OAUTH_STATUS} from 'src/util/constant';

interface SlackEventBody {
  type?: string; // `type` is optional because not all bodies might have it
  challenge?: string;
  [key: string]: any; // To allow additional fields
}
@ApiTags('Slack Events')
@Controller('slack')
@Public()
export class PublicEventController {
  @Inject(forwardRef(() => EventService))
  private readonly service: EventService;

  @Inject(forwardRef(() => AuthService))
  private readonly authService: AuthService;

  @Get('/ping')
  async findAllPinCodes() {
    return 'Ok';
  }

  @Post('events') // ${baseurl}/custom/slack/events
  async handleSlackEvent(@Request() req, @Response() res, @Body() body: SlackEventBody) {
    if (body.type === 'url_verification') {
      console.log('Received Slack Event:', body);
      return res.status(200).send(body.challenge);
    } else {
      res.status(200).send();
      await this.service.handleEvent(body);
    }
  }

  @Post('options')
  async handleSlackDropdownOptions(@Request() req, @Response() res, @Body() body: SlackEventBody) {
    await this.service.handleDropdownOptions(body, res);
  }

  @Post('actions')
  async handleActions(@Request() req, @Response() res, @Body() body: any) {
    res.status(200).send();
    return await this.service.handleAction(body);
  }

  @Get('oauth/callback')
  async handleOAuth(@Request() req, @Response() res) {
    const code = req.query.code;
    if (!code) {
      res.redirect(`/fail.html`);
      return;
    }
    try {
      const response = await this.service.handleOAuth(code);
      console.log('Response from handleOAuth:', res);
      if (response.status === SLACK_OAUTH_STATUS.SUCCESS && response.data) {
        res.redirect(`/success.html?app_id=${response.data.app_id || ''}`);
      } else {
        res.redirect(`/fail.html`);
      }
    } catch (error) {
      console.error('Error exchanging code for access token:', error);
      return res.status(500).send('An error occurred during authentication.');
    }
  }
}
