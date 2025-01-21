import {Log} from '@kaiju-lib/node-common';
import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {WebClient} from '@slack/web-api';
import axios from 'axios';
import {AuthService} from 'src/service/auth.service';
import {HawkeyeService} from 'src/service/hawkeye.core.service';
import {HelperService} from 'src/service/helpers.service';
import {MasterDataService} from 'src/service/masterdata.service';
import {
  SESSION_TYPE,
  SESSION_TYPE_KEYS,
  SLACK_BLOCKS,
  SLACK_BUTTONS_ACTIONS,
  SLACK_DROPDOWN_ACTIONS,
  SLACK_DROPDOWN_BLOCK_ID,
  SLACK_EVENTS,
  SLACK_INPUT_ACTIONS,
  SLACK_OAUTH_STATUS,
} from 'src/util/constant';
import {extractProgressStatus, generateUrl, getSystemDateTime} from 'src/util/util';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private abortControllers = new Map<string, AbortController>();

  @Inject(forwardRef(() => MasterDataService))
  private readonly masterService: MasterDataService;

  @Inject(forwardRef(() => AuthService))
  private readonly authService: AuthService;

  @Inject(forwardRef(() => HawkeyeService))
  private readonly hawkeyeService: HawkeyeService;

  @Inject(forwardRef(() => HelperService))
  private readonly helperService: HelperService;

  @Log()
  async handleOAuth(code: string): Promise<{status: string; data?: any}> {
    try {
      // Exchange code for access token
      const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
        params: {
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          code: code,
        },
      });
      const data = response.data;
      if (data.ok) {
        this.authService.saveInstallConfiguration(data);
        return {
          status: SLACK_OAUTH_STATUS.SUCCESS,
          data: data,
        };
      } else {
        return {
          status: SLACK_OAUTH_STATUS.FAIL,
        };
      }
    } catch (error) {
      return {
        status: SLACK_OAUTH_STATUS.FAIL,
        data: error.response?.data || error.message,
      };
    }
  }

  @Log()
  async handleEvent(body: any) {
    try {
      const event = body.event;
      if (event) {
        const slackClient = await this.getSlackClient(body.team_id);
        if (event.type === SLACK_EVENTS.APP_HOME_OPENED) {
          await this.handleAppHomeOpened(slackClient, event.user, body.team_id);
        } else if (event.type === SLACK_EVENTS.MESSAGE) {
          this.logger.warn('Handling message event:', event);
          await this.handleMessageEvent(slackClient, body);
        } else if (event.type === SLACK_EVENTS.APP_MENTION) {
          this.logger.warn('Handling App Mention event:', event);
          await this.handleAppMentionEvent(slackClient, body);
        } else if (event.type === SLACK_EVENTS.APP_UNINSTALLED) {
          this.logger.warn('App was uninstalled from this workspace.');
          await this.masterService.deleteAllRowsByTeamId(body.team_id);
        }
      }
    } catch (error) {
      console.error('Error handling Slack event:', error);
    }
  }

  async handleMessageEvent(slackClient, body: any) {
    const event = body.event;
    const channelId = event.channel;
    const threadTs = event.event_ts;
    const teamId = body.team_id;

    const installConfig = await this.getInstallationInformation(teamId);

    if (event?.user === installConfig?.bot_user_id || event?.bot_id || event?.message?.bot_id) {
      console.log('Bot message, ignoring');
      return;
    }
    const config = await this.masterService.getConfig(body.event.team);
    if (!config) {
      try {
        const result = await slackClient.chat.postEphemeral({
          channel: event.channel,
          text: 'Hawkeye is not configured. Please set the Neubird Instance URL(Base URL) and Access Token to proceed.',
          user: event.user,
        });
        console.log('Ephemeral message sent:', result);
      } catch (error) {
        console.error('Error sending ephemeral message:', error);
      }
      return;
    }
    // @ts-ignore
    const botUserId = installConfig.bot_user_id;
    const prompt = event.text.replace(`<@${botUserId}>`, '').trim();

    // @ts-ignore
    if (event.user === installConfig.bot_user_id || event?.bot_id) {
      this.logger.warn('Bot message, ignoring');
      return;
    } else {
      if (event?.parent_user_id) {
        // sub thread already created
        const parentThreadId = event?.thread_ts;
        const teamId = event?.team;
        const channelId = event?.channel;

        const threadInformation = await this.masterService.getThreadData(teamId, channelId, parentThreadId, true);
        this.logger.warn(`Parent thread Information DM :>> , ${threadInformation}`);

        if (threadInformation) {
          const channelInformation = {...threadInformation, prompt};
          const payload = {
            team: {id: teamId},
            channel: {id: channelId},
            message: {ts: parentThreadId},
            isSubThread: true,
          };
          await this.renderMessage(payload, channelInformation);
          return;
        }
      }

      try {
        await slackClient.reactions.add({
          channel: event.channel,
          name: 'bulb',
          timestamp: event.ts,
        });
      } catch (error) {
        this.logger.error('Error handling App Mention event:', error);
      }
    }

    const directMessageInformation = await this.getChannelInformation(teamId, channelId, true);
    //  T_T01V51RCN15:C_D083E85KE1H:DIRECT_MESSAGE_META_DATA
    console.log('directMessageInformation', directMessageInformation);
    if (!directMessageInformation) {
      this.logger.warn('DM metadata doesnot exist');
      try {
        await this.showProjectSessionSelectionButton(slackClient, channelId, prompt);
      } catch (error) {
        this.logger.error('showProjectSessionSelectionButton DM error:>>', error.message);
      }
    } else {
      this.logger.warn('DM metadata exist');
      try {
        await this.showConfirmationMessage(slackClient, channelId, directMessageInformation, prompt);
      } catch (error) {
        this.logger.error('showConfirmationMessage DM error:>>', error.message);
      }
    }
  }

  async handleAppHomeOpened(slackClient, userId: string, teamId: string) {
    try {
      const configure = await this.masterService.getConfig(teamId);
      this.logger.debug(`Configured ${configure}`);

      if (configure) {
        const adminList = await this.findWorkspaceAdmins(slackClient);
        const isAdmin = adminList.length > 0 ? adminList.find(admin => admin.id === userId) : false;
        const isConfiguredUser = configure.configuredUser?.id === userId ? configure.configuredUser : null;
        await slackClient.views.publish({
          user_id: userId,
          view: {
            type: 'home',
            blocks: await this.generateConfigSuccessBlockView(isConfiguredUser || isAdmin, configure),
          },
        });
      } else {
        await slackClient.views.publish({
          user_id: userId,
          view: {
            type: 'home',
            blocks: await this.generateConfigEditBlockView(),
          },
        });
      }
    } catch (error) {
      console.error('Error handling App Home Opened event:', error);
    }
  }

  async handleDropdownOptions(body, res) {
    const optionsPayloadString = body.payload;
    const optionsPayloadJSON = JSON.parse(optionsPayloadString);
    console.log('handleDropdownOptions optionsPayloadJSON called:>>', optionsPayloadJSON);
    const searchText = optionsPayloadJSON?.value ? optionsPayloadJSON?.value : '';
    const {requestId, projectId} = optionsPayloadJSON?.block_id ? JSON.parse(optionsPayloadJSON?.block_id) : '';
    const teamId = optionsPayloadJSON?.team?.id ? optionsPayloadJSON?.team?.id : '';
    const existingSessionList = await this.hawkeyeService.fetchAllExistingSessions(requestId, teamId, projectId);
    console.log('handleDropdownOptions teamId:>>', teamId);
    console.log('handleDropdownOptions existingSessionList', existingSessionList);

    console.log('existing session searched here');
    const filteredSessions = existingSessionList.filter(session =>
      session.name?.toLowerCase().includes(searchText.toLowerCase()),
    );
    try {
      const options =
        filteredSessions.length > 0
          ? filteredSessions.map(session => ({
              text: {
                type: 'plain_text',
                text: session?.name || 'Unnamed session',
              },
              value: session.session_uuid,
            }))
          : [
              {
                text: {
                  type: 'plain_text',
                  text: 'No matching session',
                },
                value: 'no_matching_session',
              },
            ];
      console.log('session options--', options);
      res.json({options});
      // await slackClient.chat.update({
      //   channel: channelId,
      //   blocks: [
      //     {
      //       type: "section",
      //       block_id: "existing_session_selected_txt", // New block_id for the selected project message
      //       text: {
      //         type: "mrkdwn",
      //         text: `You have selected ${globalProjectName} \n  ${globalSessionTypeTxt} \n`,
      //       },
      //     },
      //     {
      //       type: "input",
      //       block_id: "existing_session_selected", // New block_id for the session selection dropdown
      //       element: {
      //         type: "static_select",
      //         placeholder: {
      //           type: "plain_text",
      //           text: "Search ",
      //           emoji: true,
      //         },
      //         options: sessionsList.map((session) => {
      //           return {
      //             text: {
      //               type: "plain_text",
      //               text: session.name || "Unnamed Session",
      //               emoji: true,
      //             },
      //             value: session.session_uuid,
      //           };
      //         }),
      //         action_id: "existing_session_selected", // Unique action_id for the session dropdown
      //       },
      //       label: {
      //         type: "plain_text",
      //         text: `Choose an existing Session`,
      //         emoji: true,
      //       },
      //     },
      //   ],
      //   thread_ts: threadTs, // original msg timestamp that started thread
      //   ts: ts, //timestamp of msg that we want to update
      // });
    } catch (error) {
      console.log('Error occured in fetching sessions', error);
    }

    // if (blockId == "select_project") {
    //   try {
    //     //TODO:Query Param
    //     //LIMITATION only 100 options
    //     const allProjectUrl = `${BASE_URL}/api/v1/project?system_project_type=SYSTEM_PROJECT_TYPE_UNSPECIFIED&search=${encodeURIComponent(
    //       userSearch
    //     )}`;
    //     console.log("allProjectUrl", allProjectUrl);
    //     const allProjectsResponse = await axios.get(allProjectUrl, {
    //       headers: {
    //         Accept: "application/json",
    //         Authorization: `Bearer ${globalAccessToken}`,
    //       },
    //     });
    //     console.log("allProjectsResponse---", allProjectsResponse);
    //     if (allProjectsResponse.statusText === "OK") {
    //       const data = allProjectsResponse.data;

    //       if (data) {
    //         globalRequestId = data?.response?.request_id || "";
    //         const projects = data?.specs || [];

    //         // if (allProjects.length > 0) {
    //         console.log("Projects", projects);
    //         const options =
    //           projects.length > 0
    //             ? projects.map((project) => ({
    //                 text: {
    //                   type: "plain_text",
    //                   text: project?.name || "Unnamed Project",
    //                 },
    //                 value: project?.uuid,
    //               }))
    //             : [
    //                 {
    //                   text: {
    //                     type: "plain_text",
    //                     text: "No matching projects",
    //                   },
    //                   value: "no_matching_project",
    //                 },
    //               ];
    //         console.log("options--", options);
    //         res.json({ options });
    //         // Update Slack message with projects
    //         // const projectBlocks = generateProjectBlocks(allProjects);
    //         // await slackClient.chat.update({
    //         //   channel: channelId,
    //         //   ts: messageTimestamp,
    //         //   blocks: [...projectBlocks],
    //         // });
    //         // }
    //         // else {
    //         // Update Slack message with projects
    //         // await slackClient.chat.update({
    //         //   channel: channelId,
    //         //   ts: messageTimestamp,
    //         //   text: "Currently no projects available",
    //         // });
    //         // }
    //       }
    //     } else {
    //       console.log("Something went wrong here");
    //     }
    //   } catch (error) {
    //     console.log("Error occurred in all projects API call", error);

    //     // Notify Slack about the error
    //     slackClient.chat.update({
    //       channel: channelId,
    //       text: "An error occurred while processing your request. Please try again later.",
    //       thread_ts: threadTs,
    //       ts: ts,
    //     });
    //   }
  }

  async handleAppMentionEvent(slackClient: WebClient, body: any) {
    const event = body.event;
    console.log('handleAppMentionEvent triggered now:>>', body);

    const installConfig = await this.getInstallationInformation(body.event.team);
    const config = await this.masterService.getConfig(body.event.team);
    if (!config) {
      try {
        const result = await slackClient.chat.postEphemeral({
          channel: event.channel,
          text: 'Hawkeye is not configured. Please set the Neubird Instance URL(Base URL) and Access Token to proceed.',
          user: event.user,
        });
        console.log('Ephemeral message sent:', result);
      } catch (error) {
        console.error('Error sending ephemeral message:', error);
      }
      return;
    }

    // @ts-ignore
    const botUserId = installConfig.bot_user_id;
    // console.log('Bot User ID:', installConfig.bot_user_id);
    // @ts-ignore
    if (event.user === installConfig.bot_user_id || event.bot_id) {
      console.log('Bot message, ignoring');
      return;
    }

    const prompt = event.text.replace(`<@${botUserId}>`, '').trim();

    if (event?.parent_user_id) {
      // sub thread already created
      const parentThreadId = event?.thread_ts;
      const teamId = event?.team;
      const channelId = event?.channel;

      const threadInformation = await this.masterService.getThreadData(teamId, channelId, parentThreadId, false);
      this.logger.warn('Parent thread Information :>> ', threadInformation);

      if (threadInformation) {
        const channelInformation = {...threadInformation, prompt};
        const payload = {
          team: {id: teamId},
          channel: {id: channelId},
          message: {ts: parentThreadId},
          isSubThread: true,
        };
        await this.renderMessage(payload, channelInformation);
        return;
      }
    }
    try {
      await slackClient.reactions.add({
        channel: event.channel,
        name: 'bulb',
        timestamp: event.ts,
      });
    } catch (error) {
      this.logger.error('Error handling App Mention event:', error);
    }

    if (!prompt) {
      try {
        const result = await slackClient.chat.postEphemeral({
          channel: event.channel,
          text: 'Please type your question or prompt to get started with Hawkeye',
          user: event.user,
        });
        console.log('Ephemeral message for prompt sent:', result);
      } catch (error) {
        console.error('Error sending ephemeral message  for prompt:', error);
      }
      return;
    }

    //check channel info exists
    const channelInformation = await this.getChannelInformation(body.event.team, event.channel, false);
    if (!channelInformation) {
      this.logger.warn('Channel metadata doesnot exist');
      try {
        await this.showProjectSessionSelectionButton(slackClient, event.channel, prompt);
      } catch (error) {
        this.logger.error('showProjectSessionSelectionButton error:>>', error.message);
      }
    } else {
      this.logger.warn('Channel metadata exist');
      try {
        await this.showConfirmationMessage(slackClient, event.channel, channelInformation, prompt);
      } catch (error) {
        this.logger.error('showConfirmationMessage error:>>', error.message);
      }
    }
  }

  async getWorkspaceInfo(slackClient: WebClient) {
    try {
      const result = await slackClient.team.info();
      // console.log('Team info:', result);
      return result;
    } catch (error) {
      console.error('Error fetching team info:', error);
    }
  }

  private async processNewSessionSubmission(parsedPayload) {
    console.log('processNewSessionSubmission', JSON.stringify(parsedPayload));
    const teamId = parsedPayload?.team?.id;
    console.log('processNewSessionSubmission teamId :>>', JSON.stringify(parsedPayload));
    const privateMetadata = JSON.parse(parsedPayload?.view?.private_metadata);
    const channelId = privateMetadata?.channel_id;
    const requestId = privateMetadata.requestId;
    const prompt = privateMetadata.prompt;

    // Fields from the view can be taken from state directly
    const projectId =
      parsedPayload.view.state.values[SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK][
        SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN
      ]?.selected_option?.value;
    const projectName =
      parsedPayload.view.state.values[SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK][
        SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN
      ]?.selected_option?.text?.text;

    try {
      const sessionId = await this.hawkeyeService.getNewSessionId(projectId, requestId, teamId);
      console.log('New session ID:', sessionId);
      const channelInformation = {
        teamId,
        channelId,
        projectId,
        projectName,
        sessionId,
        sessionName: prompt,
        requestId,
        prompt,
      };
      if (sessionId) {
        await this.renderMessage(parsedPayload, channelInformation, true);
      }
    } catch (error) {
      // console.error('Error in processNewSessionSubmission:', error.response?.data || error.message);
      this.logger.error('Error in processNewSessionSubmission:', error.response?.data || error.message);
    }
  }

  private async processExistingSessionSubmission(parsedPayload) {
    try {
      console.log('processExistingSessionSubmission', parsedPayload);
      const privateMetadata = JSON.parse(parsedPayload?.view?.private_metadata);

      console.log('processExistingSessionSubmission teamId:>>', parsedPayload.team.id);
      console.log('processExistingSessionSubmission privatemetadata:>>', parsedPayload.team.id);
      const channelInformation = {
        teamId: parsedPayload.team.id,
        channelId: privateMetadata.channel_id,
        projectId: privateMetadata.projectId,
        projectName: privateMetadata.projectName,
        sessionId: privateMetadata.sessionId,
        sessionName: privateMetadata.sessionName,
        requestId: privateMetadata.requestId,
        prompt: privateMetadata.prompt,
      };
      await this.renderMessage(parsedPayload, channelInformation, true);
    } catch (error) {
      console.error('Error in processExistingSessionSubmission:', error.response?.data || error.message);
    }
  }

  async fetchProjects(teamId: string) {
    try {
      const projectsListResponse = await this.hawkeyeService.fetchProjects(teamId);

      if (!projectsListResponse) {
        return {requestId: '', projects: []};
      }
      const {requestId, projects} = projectsListResponse;

      return {requestId, projects};
    } catch (error) {
      console.log('Error occured in fetchProjects :>> ', error);
      return {requestId: '', projects: []};
    }
  }

  async showProjectSessionModal(parsedPayload: any) {
    console.log('showProjectSessionModal called:>>', JSON.stringify(parsedPayload));
    try {
      const slackClient = await this.getSlackClient(parsedPayload.team.id);
      const triggerId = parsedPayload?.trigger_id;
      const channelId = parsedPayload?.channel?.id;
      const threadTs = parsedPayload?.message?.ts;
      const teamId = parsedPayload?.team?.id;
      const actions = parsedPayload?.actions[0]; // actions can be multiple only when multiselect component
      const prompt = actions?.value ? JSON.parse(actions?.value)?.question : '';
      console.log('teamId in showProjectSessionModal:>>', teamId);
      if (!triggerId) {
        console.error('Trigger ID is missing.');
        return;
      }

      let privateMetadata = await this.helperService.preparePrivateMetadata({
        channel_id: channelId,
        thread_ts: threadTs,
        prompt: prompt,
        teamId: teamId,
      });
      //TODO: update text
      const placeholderModal = await slackClient.views.open({
        trigger_id: triggerId,
        view: {
          type: 'modal',
          title: {
            type: 'plain_text',
            text: 'Loading...',
          },
          // private_metadata: JSON.stringify({channel_id: channelId, thread_ts: threadTs}),
          private_metadata: privateMetadata,
          //@ts-ignore
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Fetching details. Please wait...',
              },
            },
          ],
        },
      });

      const projectsResponse = await this.fetchProjects(teamId);

      if (!projectsResponse) {
        this.logger.error('Something went wrong in fetchProjects');
        await slackClient.views.update({
          view_id: placeholderModal.view.id,
          view: {
            type: 'modal',
            callback_id: 'error_modal', // TODO:from constant
            private_metadata: privateMetadata,
            title: {type: 'plain_text', text: 'Error'},
            close: {type: 'plain_text', text: 'Close'},
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: 'There was an issue fetching the projects. Please try again later.',
                },
              },
            ],
          },
        });
        return;
      }

      if (projectsResponse.projects.length === 0) {
        this.logger.warn('No Projects available');
        await slackClient.views.update({
          view_id: placeholderModal.view.id,
          view: {
            type: 'modal',
            callback_id: 'no_projects_modal', //TODO:take from constant
            title: {type: 'plain_text', text: 'No Projects Available'},
            private_metadata: privateMetadata,
            close: {type: 'plain_text', text: 'Close'},
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: 'No projects are available at the moment. Please try again later.',
                },
              },
            ],
          },
        });
        return;
      }

      const projects = projectsResponse.projects;
      const requestId = projectsResponse.requestId;
      const projectId = '';
      let sessionType = '';

      const isDirectMessage = channelId.toLowerCase().startsWith('d');
      console.log('showProjectSessionModal isDirectMessage:>>', isDirectMessage);

      // need to write comment
      const channelInformation = await this.getChannelInformation(teamId, channelId, isDirectMessage);

      if (channelInformation) {
        const projectId = channelInformation.projectId;
        const projectName = channelInformation.projectName;
        const sessionId = channelInformation.sessionId;
        const sessionName = channelInformation.sessionName;
        sessionType = SESSION_TYPE_KEYS.EXISTING_SESSION;
        const requestId = channelInformation.requestId;

        const projectDropdownBlocks = await this.generateProjectDropdownBlocks(
          teamId,
          projects,
          projectId,
          projectName,
        );
        const newExistingRadioBlocks = await this.createSessionTypeRadioButtonsBlocks(sessionType);
        const existingSessionsDropdownBlocks = await this.generateExistingSessionDropdownBlocks(
          requestId,
          projectId,
          sessionId,
          sessionName,
        );
        const submitButton =
          projectId && sessionType && sessionId
            ? {type: 'plain_text', text: 'Start Analysis'} // Show submit button if value is selected
            : undefined;
        await slackClient.views.update({
          view_id: placeholderModal.view.id,
          view: {
            type: 'modal',
            callback_id: 'initial_modal',
            title: {type: 'plain_text', text: 'Select Project & Session'},
            private_metadata: await this.helperService.preparePrivateMetadata({
              ...JSON.parse(privateMetadata),
              requestId,
              projectId,
              projectName,
              sessionId,
              sessionName,
              //directly click without changing
            }),
            close: {type: 'plain_text', text: 'Cancel'},
            //@ts-ignore
            submit: submitButton,
            blocks: [...projectDropdownBlocks, ...newExistingRadioBlocks, ...existingSessionsDropdownBlocks],
          },
        });
      } else {
        this.logger.warn('Opened without channel configuration :>>');
        console.log('Opened without channel configuration :>>', teamId);
        const projectDropdownBlocks = await this.generateProjectDropdownBlocks(teamId, projects);
        // on initial render project dropdown
        const submitButton =
          projectId && sessionType
            ? {type: 'plain_text', text: 'Start Analysis'} // Show submit button if value is selected
            : undefined;
        sessionType = SESSION_TYPE_KEYS.NEW_SESSION;
        console.log('requestid from projects--', requestId);
        await slackClient.views.update({
          view_id: placeholderModal.view.id,
          view: {
            type: 'modal',
            callback_id: 'initial_modal',
            title: {type: 'plain_text', text: 'Select Project & Session'},
            private_metadata: await this.helperService.preparePrivateMetadata({
              ...JSON.parse(privateMetadata),
              requestId,
            }),
            close: {type: 'plain_text', text: 'Cancel'},
            //@ts-ignore
            submit: submitButton,
            blocks: [...projectDropdownBlocks],
          },
        });
      }
    } catch (error) {
      console.error('Error occurred while opening project session modal:', error);
    }
  }
  /*Uncomment for static select
  private generateExistingSessionDropdownBlocks() {
    console.log('generateExistingSessionDropdownBlocks>>', this.sessionName, this.sessionId, this.existingSessionList);
    return [
      {
        type: 'section',
        block_id: 'existing_session_selected_block',
        text: {
          type: 'mrkdwn',
          text: '*Session*',
        },
        accessory: {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Choose Existing session',
          },
          options: this.existingSessionList.map(session => ({
            text: {type: 'plain_text', text: session.name || 'Unnamed session'},
            value: session.session_uuid,
          })),
          ...(this.sessionName && this.sessionId
            ? {
                initial_option: {
                  text: {
                    type: 'plain_text',
                    text: `${this.sessionName || 'Unnamed Project'}`,
                    emoji: true,
                  },
                  value: this.sessionId,
                },
              }
            : {}),
          action_id: SLACK_DROPDOWN_ACTIONS.EXISTING_SESSION_DROPDOWN_SELECTION,
        },
      },
    ];
  }
*/

  private async generateExistingSessionDropdownBlocks(
    requestId?: string,
    projectId?: string,
    sessionId?: string,
    sessionName?: string,
  ) {
    // console.log('generateExistingSessionDropdownBlocks>>', this.sessionName, this.sessionId, this.existingSessionList);
    return [
      {
        type: 'section',
        block_id: JSON.stringify({projectId, requestId}),
        text: {
          type: 'mrkdwn',
          text: '*Session*',
        },
        accessory: {
          type: 'external_select', // Changed to external_select
          placeholder: {
            type: 'plain_text',
            text: 'Choose Existing session',
          },
          ...(sessionName && sessionId
            ? {
                initial_option: {
                  text: {
                    type: 'plain_text',
                    text: `${sessionName || 'Unnamed Project'}`,
                    emoji: true,
                  },
                  value: sessionId,
                },
              }
            : {}),
          action_id: SLACK_DROPDOWN_ACTIONS.EXISTING_SESSION_DROPDOWN_SELECTION,
          min_query_length: 1,
        },
      },
    ];
  }

  // ===================== HANDLERS =====================

  async onProjectChange(parsedPayload) {
    console.log('onProjectChange:>>', JSON.stringify(parsedPayload));
    const privateMetadata = JSON.parse(parsedPayload?.view?.private_metadata);
    const teamId = parsedPayload?.team?.id;
    console.log('onProjectChange teamId:>>', teamId);
    const action = parsedPayload.actions[0]; // actions can be multiple only when multiselect component
    const projectId = action?.selected_option.value;
    const projectName = action?.selected_option?.text?.text || '';
    const sessionType = SESSION_TYPE_KEYS.NEW_SESSION; // default

    // Updating the block to show the selected project
    const updatedProjectBlock = await this.generateProjectDropdownBlocks(teamId, [], projectId, projectName);
    const updatedSessionTypeRadioBlocks = await this.createSessionTypeRadioButtonsBlocks(sessionType, true);

    const slackClient = await this.getSlackClient(teamId);

    try {
      await slackClient.views.update({
        view_id: parsedPayload.view.id,
        hash: parsedPayload.view.hash,
        view: {
          type: 'modal',
          title: {type: 'plain_text', text: 'Select Project & Session'},
          close: {type: 'plain_text', text: 'Cancel'},
          // carry forward private metadata to next view
          private_metadata: await this.helperService.preparePrivateMetadata({
            ...privateMetadata,
            projectId: projectId,
            projectName: projectName,
            sessionType: sessionType,
          }),
          submit: {type: 'plain_text', text: 'Start Analysis'},
          blocks: [...updatedProjectBlock, ...JSON.parse(JSON.stringify(updatedSessionTypeRadioBlocks))],
        },
      });
    } catch (error) {
      console.error('Error onProjectChange:', error?.response?.data || error?.message);
    }
  }
  /* new existing selection */
  async onSessionTypeChange(parsedPayload) {
    console.log('onSessionTypeChange:>>', JSON.stringify(parsedPayload));
    try {
      const projectId =
        parsedPayload.view.state.values[SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK][
          SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN
        ]?.selected_option?.value;
      const projectName =
        parsedPayload.view.state.values[SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK][
          SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN
        ]?.selected_option?.text?.text;

      const action = parsedPayload.actions[0]; // actions can be multiple only when multiselect component
      const selectedSessionOption = action?.selected_option;
      const sessionType = selectedSessionOption?.value || ''; // new_session or existing_session

      // Get private metadata from previous view
      const privateMetadata = JSON.parse(parsedPayload?.view?.private_metadata); //
      console.log('onSessionType Change privateMetadata:>>', privateMetadata);

      const teamId = parsedPayload?.team?.id;
      const slackClient = await this.getSlackClient(teamId);
      console.log('onSessionType Change teamId:>>', teamId);
      // Updating the block to show the selected project
      const updatedProjectBlock = await this.generateProjectDropdownBlocks(teamId, [], projectId, projectName);
      const updatedSessionTypeRadioBlocks = await this.createSessionTypeRadioButtonsBlocks(sessionType);

      if (sessionType === SESSION_TYPE_KEYS.EXISTING_SESSION) {
        try {
          const existingSessionsDropdown = await this.generateExistingSessionDropdownBlocks(
            privateMetadata.requestId,
            projectId,
          );
          const sessionId = '';
          const submitButton =
            projectId && sessionType && sessionId
              ? {type: 'plain_text', text: 'Start Analysis'} // Show submit button if value is selected
              : undefined;

          await slackClient.views.update({
            view_id: parsedPayload.view.id,
            hash: parsedPayload.view.hash,
            view: {
              type: 'modal',
              title: {type: 'plain_text', text: 'Select Project & Session'},
              private_metadata: await this.helperService.preparePrivateMetadata({
                ...privateMetadata,
                sessionType: sessionType,
              }),
              close: {type: 'plain_text', text: 'Cancel'},
              //@ts-ignore
              submit: submitButton,
              blocks: [...updatedProjectBlock, ...updatedSessionTypeRadioBlocks, ...existingSessionsDropdown],
            },
          });
        } catch (error) {
          console.error('Error fetching existing sessions or updating view:', error?.response?.data || error?.message);
        }
      } else {
        try {
          await slackClient.views.update({
            view_id: parsedPayload.view.id,
            hash: parsedPayload.view.hash,
            view: {
              type: 'modal',
              // carry forward private metadata to next view with new data(projectName, projectId, sessionType)
              private_metadata: await this.helperService.preparePrivateMetadata({
                ...privateMetadata,
                projectName: projectName,
                projectId: projectId,
                sessionType: sessionType,
              }),
              title: {type: 'plain_text', text: 'Select Project & Session'},
              close: {type: 'plain_text', text: 'Cancel'},
              submit: {type: 'plain_text', text: 'Start Analysis'},
              blocks: [...updatedProjectBlock, ...updatedSessionTypeRadioBlocks],
            },
          });
        } catch (error) {
          console.error('Error updating view for new session:', error?.response?.data || error?.message);
        }
      }
    } catch (error) {
      console.error('Error in onSessionTypeChange:', error.response?.data || error.message);
    }
  }

  async onSessionSelect(parsedPayload) {
    console.log('onSessionSelect:>>', JSON.stringify(parsedPayload));
    try {
      const action = parsedPayload.actions[0]; // actions can be multiple only when multiselect component
      const selectedSessionOption = action?.selected_option;
      const selectedOptionText = selectedSessionOption?.text?.text || '';
      const sessionId = selectedSessionOption?.value || '';
      const sessionName = selectedOptionText;

      const projectId =
        parsedPayload.view.state.values[SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK][
          SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN
        ]?.selected_option?.value;
      const projectName =
        parsedPayload.view.state.values[SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK][
          SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN
        ]?.selected_option?.text?.text;

      const privateMetadata = JSON.parse(parsedPayload?.view?.private_metadata);

      const teamId = parsedPayload?.team?.id;
      const slackClient = await this.getSlackClient(teamId);
      console.log('Innnn session select ----------payload team id', teamId);
      console.log('Innnn session select ----------privateMetadata.teamId', privateMetadata.teamId);
      const updatedProjectBlock = await this.generateProjectDropdownBlocks(teamId, [], projectId, projectName);
      const sessionType = SESSION_TYPE_KEYS.EXISTING_SESSION;

      const newExistingRadioBlocks = await this.createSessionTypeRadioButtonsBlocks(sessionType);
      const existingSessionsDropdown = await this.generateExistingSessionDropdownBlocks(
        privateMetadata.requestId,
        projectId,
        sessionId,
        sessionName,
      );

      try {
        await slackClient.views.update({
          view_id: parsedPayload.view.id,
          hash: parsedPayload.view.hash,
          view: {
            type: 'modal',
            title: {type: 'plain_text', text: 'Select Project & Session'},
            close: {type: 'plain_text', text: 'Cancel'},
            // carry forward private metadata to next view with new data(sessionName, sessionId)
            private_metadata: await this.helperService.preparePrivateMetadata({
              ...privateMetadata,
              sessionId: sessionId,
              sessionName: sessionName,
              projectId: projectId,
              projectName: projectName,
              sessionType: sessionType,
            }),
            submit: {type: 'plain_text', text: 'Start Analysis'},
            blocks: [...updatedProjectBlock, ...newExistingRadioBlocks, ...existingSessionsDropdown],
          },
        });
      } catch (error) {
        console.error('Error updating onExistingSessionSelect view:', error?.response?.data || error?.message);
      }
    } catch (error) {
      console.error('Error in onExistingSessionSelect:', error?.response?.data || error?.message);
    }
  }

  private async handleProjectSessionInfoChangeNo(parsedPayload) {
    try {
      console.log('handleProjectSessionInfoChangeNo :>>', parsedPayload);
      //question pass and requestid yet todo
      // User wants to continue with the same session
      const actions = parsedPayload?.actions[0]; // actions can be multiple only when multiselect component

      const prompt = actions?.value ? JSON.parse(actions?.value)?.question : '';

      const isDirectMessage = parsedPayload.channel.id.toLowerCase().startsWith('d');
      console.log('isDirectMessage handleProjectSessionInfoChangeNo:>>', isDirectMessage);

      const existingChannelInformation = await this.getChannelInformation(
        parsedPayload.team.id,
        parsedPayload.channel.id,
        isDirectMessage,
      );
      const channelInformation = {...existingChannelInformation, prompt};
      console.log('channelInformation on no :>>', channelInformation);
      await this.renderMessage(parsedPayload, channelInformation);
    } catch (error) {
      console.error('Error in handleProjectSessionInfoChangeNo:', error?.response?.data || error?.message);
    }
  }

  private async getChannelInformation(teamId: string, channelId: string, isDirectMessage: boolean = false) {
    if (isDirectMessage) {
      const directMessageInfo = await this.masterService.getDirectMessageData(teamId, channelId);
      this.logger.warn('getDirectMessageInformation from db:>>', directMessageInfo);
      return directMessageInfo;
    }
    const channelInfo = await this.masterService.getChannelData(teamId, channelId);
    this.logger.warn('getting channelInfo from db:>>', channelInfo);
    return channelInfo;
  }

  private async handleProjectSessionInfoChangeYes(parsedPayload) {
    try {
      console.log('handleProjectSessionInfoChangeYes:>>', JSON.stringify(parsedPayload));
      await this.showProjectSessionModal(parsedPayload);
    } catch (error) {
      console.error('Error in handleProjectSessionInfoChangeYes:', error?.response?.data || error?.message);
    }
  }

  // Handle Actions
  @Log()
  async handleAction(body: any) {
    const parsedPayload = JSON.parse(body.payload);
    this.logger.warn('Handling action:', parsedPayload);
    // this.teamId = parsedPayload.team.id;

    try {
      const installConfig = await this.getInstallationInformation(parsedPayload?.team?.id);
      if (!installConfig) {
        this.logger.warn('Installation not found for team:', parsedPayload.team.domain);
        return;
      }
    } catch (error) {
      this.logger.warn('Installation not found for team:', parsedPayload.team.domain);
      return 'Ok';
    }

    if (parsedPayload?.type === 'block_actions') {
      const actionId = parsedPayload.actions[0].action_id;

      switch (actionId) {
        case 'stop_button':
          const timestamp = parsedPayload?.message?.thread_ts;
          const abortKey = `${parsedPayload.team.id}-${parsedPayload.channel.id}-${timestamp}`; // Unique key based on teamId and channelId
          console.log('abortKey again', abortKey);
          console.log('stopProcess--');
          const abortController = this.abortControllers.get(abortKey);
          if (abortController) {
            abortController.abort(); // Abort the ongoing process
            this.abortControllers.delete(abortKey); // Remove the controller from the map
            console.log(`Process for ${abortKey} aborted.`);
          } else {
            console.log(`No process found for Key ${abortKey}.`);
          }
          break;
        case SLACK_INPUT_ACTIONS.NO_ACTION_INPUT:
          console.log('No Action', parsedPayload.type);
          break;
        case SLACK_BUTTONS_ACTIONS.SAVE_CONFIG_BUTTON:
          await this.handleSaveConfigAction(parsedPayload);
          break;
        case SLACK_BUTTONS_ACTIONS.UPDATE_CONFIG_BUTTON:
          await this.handleSaveConfigAction(parsedPayload, true);
          break;
        case SLACK_BUTTONS_ACTIONS.EDIT_CONFIG_BUTTON:
          await this.handleUpdateConfigAction(parsedPayload);
          break;
        case SLACK_BUTTONS_ACTIONS.SAVE_PROJECT_SESSION_DETAILS_BUTTON:
          await this.showProjectSessionModal(parsedPayload);
          break;
        case SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN:
          this.onProjectChange(parsedPayload);
          break;
        case SLACK_DROPDOWN_ACTIONS.SESSION_TYPE_DROPDOWN:
          this.onSessionTypeChange(parsedPayload);
          break;
        case SLACK_DROPDOWN_ACTIONS.EXISTING_SESSION_DROPDOWN_SELECTION:
          this.onSessionSelect(parsedPayload);
          break;
        case SLACK_BUTTONS_ACTIONS.CHANGE_PROJECT_SESSION_YES_BUTTON:
          this.handleProjectSessionInfoChangeYes(parsedPayload);
          break;
        case SLACK_BUTTONS_ACTIONS.CHANGE_PROJECT_SESSION_NO_BUTTON:
          this.handleProjectSessionInfoChangeNo(parsedPayload);
          break;
        default:
          console.error('Unknown action type:', parsedPayload.type);
      }
    } else if (parsedPayload?.type === SLACK_BUTTONS_ACTIONS.SUBMIT_VIEW_BUTTON) {
      // Move to constant
      const privateMetadata = JSON.parse(parsedPayload.view.private_metadata);
      if (privateMetadata.sessionType == SESSION_TYPE_KEYS.NEW_SESSION) {
        this.processNewSessionSubmission(parsedPayload);
      } else {
        // Existing session
        this.processExistingSessionSubmission(parsedPayload);
      }
    }

    return 'Ok';
  }

  @Log()
  async handleSaveConfigAction(payload: any, isUpdateMode?: boolean) {
    this.logger.warn('Save Config:');
    const slackClient = await this.getSlackClient(payload.team.id);
    const url = payload.view.state.values[SLACK_BLOCKS.BASE_URL_INPUT_BLOCK][SLACK_INPUT_ACTIONS.BASE_URL_INPUT].value;
    const apiKey = payload.view.state.values[SLACK_BLOCKS.API_KEY_INPUT_BLOCK][SLACK_INPUT_ACTIONS.API_KEY_INPUT].value;
    if (!url) {
      await slackClient.views.publish({
        user_id: payload.user.id,
        view: {
          type: 'home',
          blocks: await this.generateConfigEditBlockView(
            '⚠️ Neubird Instance URL is mandatory',
            undefined,
            isUpdateMode,
          ),
        },
      });
      return 'Ok';
    }
    if (!apiKey) {
      await slackClient.views.publish({
        user_id: payload.user.id,
        view: {
          type: 'home',
          blocks: await this.generateConfigEditBlockView('⚠️ Access Token is mandatory', undefined, isUpdateMode),
        },
      });
      return 'Ok';
    }
    const config = {
      url: url,
      apiKey: apiKey,
      configuredUser: payload.user,
    };
    this.logger.debug('Config:', config);
    try {
      const response = await this.hawkeyeService.getListOfUsers(config, payload.team.id);
      this.logger.debug(`API Executed: ${response}`);
      if (isUpdateMode) {
        await this.masterService.updateConfig(payload.team.id, config);
      } else {
        await this.masterService.saveConfig(payload.team.id, config);
      }

      // Publish the updated home tab
      await slackClient.views.publish({
        user_id: payload.user.id,
        view: {
          type: 'home',
          blocks: await this.generateConfigSuccessBlockView(true, config),
        },
      });
    } catch (error) {
      console.log('Error validating tenant:', error.message);
      if (error.message.includes('401')) {
        await slackClient.views.publish({
          user_id: payload.user.id,
          view: {
            type: 'home',
            blocks: await this.generateConfigEditBlockView(
              '⚠️ Access Token provided is incorrect or has expired.',
              config,
              isUpdateMode,
            ),
          },
        });
      } else {
        await slackClient.views.publish({
          user_id: payload.user.id,
          view: {
            type: 'home',
            blocks: await this.generateConfigEditBlockView(
              '⚠️ Invalid URL. Please ensure it follows the format https://myorg.app.neubird.ai.',
              config,
              isUpdateMode,
            ),
          },
        });
      }
    }
  }

  async handleUpdateConfigAction(payload) {
    const config = await this.masterService.getConfig(payload.team.id);
    const updatedHomeBlocks = await this.generateConfigEditBlockView(undefined, config, true);
    const slackClient = await this.getSlackClient(payload.team.id);
    try {
      await slackClient.views.publish({
        user_id: payload.user.id,
        view: {
          type: 'home',
          blocks: updatedHomeBlocks,
        },
      });
    } catch (error) {
      console.error('Error publishing home tab:', error);
    }
  }

  @Log()
  async getSlackClient(teamId: any) {
    const INSTALL_CONFIG = await this.authService.getInstallConfiguration(teamId);
    // @ts-ignore
    return INSTALL_CONFIG ? new WebClient(INSTALL_CONFIG.access_token) : null;
  }

  async getInstallationInformation(teamId: any) {
    const INSTALL_CONFIG = await this.authService.getInstallConfiguration(teamId);
    return INSTALL_CONFIG || null;
  }

  async findWorkspaceAdmins(slackClient: WebClient) {
    console.log('fetching workspace admins');

    try {
      // Fetch all users in the workspace
      const response = await slackClient.users.list({});
      if (response.ok) {
        const admins = response.members.filter(member => member.is_admin);
        return admins;
      } else {
        console.error('Failed to fetch users:', response.error);
      }
    } catch (error) {
      console.error('Error fetching workspace admins:', error);
    }
  }

  // ----------------- Helper  -----------------

  private async generateConfigSuccessBlockView(isEditAccess: boolean, config?: any) {
    this.logger.debug('Config:', config);
    const blocks = isEditAccess
      ? [
          {
            type: 'actions',
            block_id: SLACK_BLOCKS.EDIT_CONFIG_BUTTON_BLOCK,
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Edit',
                },
                action_id: SLACK_BUTTONS_ACTIONS.EDIT_CONFIG_BUTTON,
                style: 'primary',
              },
            ],
          },
        ]
      : [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚠️ Edit access unavailable.',
            },
          },
        ];
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 Hawkeye is ready to assist you!',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Hawkeye has been configured 🚀\n\n:white_check_mark: Ask Hawkeye a question or describe your issue. \n\n:white_check_mark: Set context and get actionable solutions!\n\n:white_check_mark: Example prompt - @Hawkeye how many lambda functions have been provisioned?',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚙️ Configure',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*Your Neubird Instance URL*',
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'plain_text',
            text: config.url ? config.url : ' ',
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*Access Token*',
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'plain_text',
            text: '****************************',
          },
        ],
      },
      ...blocks,
    ];
  }

  private async generateConfigEditBlockView(_errorMessage?: string, config?: any, isUpdateMode?: boolean) {
    const initialBlocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚀 Configure Hawkeye to Get Started!',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Welcome to Hawkeye.\n\nTo enable Hawkeye and begin analyzing telemetry data in real-time, you’ll need to complete this one-time configuration. This establishes a secure connection between Slack and the Neubird web app.',
        },
      },
      {
        type: 'divider',
      },
    ];
    const updateBlocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 Hawkeye is ready to assist you!',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Hawkeye has been configured 🚀\n\n:white_check_mark: Ask Hawkeye a question or describe your issue. \n\n:white_check_mark: Set context and get actionable solutions!\n\n:white_check_mark: Example prompt - @Hawkeye how many lambda functions have been provisioned?',
        },
      },
      {
        type: 'divider',
      },
    ];
    const FieldBlocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚙️ Configure',
        },
      },
      {
        type: 'input',
        block_id: SLACK_BLOCKS.BASE_URL_INPUT_BLOCK,
        element: {
          type: 'plain_text_input',
          initial_value: config?.url ? config.url : '',
          action_id: SLACK_INPUT_ACTIONS.BASE_URL_INPUT,
          placeholder: {
            type: 'plain_text',
            text: ' ',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Your Neubird Instance URL *',
          emoji: false,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'plain_text',
            text: 'Eg - https://myorg.app.neubird.ai ',
          },
        ],
      },
      {
        type: 'input',
        block_id: SLACK_BLOCKS.API_KEY_INPUT_BLOCK,
        element: {
          type: 'plain_text_input',
          action_id: SLACK_INPUT_ACTIONS.API_KEY_INPUT,
          initial_value: config?.apiKey ? config.apiKey : '',
          placeholder: {
            type: 'plain_text',
            text: ' ',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Access Token *',
          emoji: false,
        },
      },
      {
        type: 'actions',
        block_id: isUpdateMode ? SLACK_BLOCKS.UPDATE_CONFIG_BUTTON_BLOCK : SLACK_BLOCKS.SAVE_CONFIG_BUTTON_BLOCK,
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: isUpdateMode ? 'Update' : 'Save',
            },
            style: 'primary',
            action_id: isUpdateMode
              ? SLACK_BUTTONS_ACTIONS.UPDATE_CONFIG_BUTTON
              : SLACK_BUTTONS_ACTIONS.SAVE_CONFIG_BUTTON,
          },
        ],
      },
    ];
    const blocks = [];
    if (isUpdateMode) {
      blocks.push(...updateBlocks);
    } else {
      blocks.push(...initialBlocks);
    }
    blocks.push(...FieldBlocks);
    if (_errorMessage) {
      blocks.push({
        type: 'section',
        text: {
          type: 'plain_text',
          text: _errorMessage,
        },
      });
    }
    return blocks;
  }

  private generateLoadingBlocks() {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':hourglass_flowing_sand: Loading, please wait...',
        },
      },
    ];
  }

  private generateResponseLoadingBlocks() {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Working on it..',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Stop',
            },
            action_id: 'stop_button',
            style: 'danger',
          },
        ],
      },
    ];
  }

  private async renderMessage(parsedPayload, channelInformation, isSaveProjectMetaDataConfiguration: boolean = false) {
    console.log('Render Message channelInformation==>', channelInformation);
    console.log('Render Message parsedPayload==>', parsedPayload);

    const teamId = parsedPayload.team.id;
    console.log('Render Message team ID==>', teamId);
    const channelId =
      parsedPayload?.channel?.id || JSON.parse(parsedPayload?.view?.private_metadata || '{}')?.channel_id;
    console.log('channelId', channelId);
    const threadTs = parsedPayload?.message?.ts || JSON.parse(parsedPayload?.view?.private_metadata || '{}')?.thread_ts;
    console.log('threadTs', threadTs);

    const slackClient = await this.getSlackClient(teamId);
    const {url} = await this.masterService.getConfig(teamId);

    const loadingBlocks = this.generateResponseLoadingBlocks();

    const isDirectMessage = channelId.toLowerCase().startsWith('d');
    const infoExistsInDB = await this.getChannelInformation(teamId, channelId, isDirectMessage);
    this.logger.warn(`infoExistsInDB :>> ${infoExistsInDB}`);

    if (infoExistsInDB) {
      const isSubThreadPrompt = parsedPayload?.isSubThread || false;
      this.logger.warn(`isSubThreadPrompt :>> ${isSubThreadPrompt}`);
      if (!isSubThreadPrompt) {
        await slackClient.chat.update({
          channel: channelId,
          text: `Still working on same project and session`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Still working on *Project*: ${infoExistsInDB?.projectName}, *Session*: ${infoExistsInDB?.sessionName}`,
              },
            },
          ],
          //@ts-ignore
          ts: threadTs, // original msg timestamp that started thread
        });
      }
    } else {
      await slackClient.chat.update({
        channel: channelId,
        text: `Project and Session`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Select your Project and Session`,
            },
          },
        ],
        //@ts-ignore
        ts: threadTs, // original msg timestamp that started thread
      });
    }

    const loadingBlockMessage = await slackClient.chat.postMessage({
      channel: channelId,
      blocks: [...loadingBlocks],
      //@ts-ignore
      thread_ts: threadTs, // original msg timestamp that started thread
    });

    const messageTimestamp = loadingBlockMessage.ts;
    const data = {
      teamId: teamId,
      channelId: channelId,
      projectId: channelInformation.projectId,
      sessionId: channelInformation.sessionId,
      projectName: channelInformation.projectName,
      sessionName: channelInformation.sessionName,
      requestId: channelInformation.requestId,
    };
    if (isSaveProjectMetaDataConfiguration) {
      console.log('saving in postgres', data);
      await this.masterService.saveChannelData(data, isDirectMessage);
    }
    const updatedData = {
      ...data,
      threadId: threadTs, // Add threadId
    };
    await this.masterService.saveThreadData(updatedData, isDirectMessage);
    try {
      let lastChatResponse = '';
      let lastChainOfThought = [];
      let sessionPromptId = '';
      let lastFileContent = [];
      let lastSessionName = '';

      const abortKey = `${teamId}-${channelId}-${threadTs}`; // Unique key based on teamId and channelId
      console.log('abortKey initial', abortKey);
      let abortController = this.abortControllers.get(abortKey);
      // If no controller exists, create a new one
      if (!abortController) {
        abortController = new AbortController();
        this.abortControllers.set(abortKey, abortController);
      }
      // console.log('privateMetadata?.requestId-- before passing', privateMetadata?.requestId);
      await this.hawkeyeService
        .getSessionResponse(
          threadTs,
          teamId,
          channelInformation.requestId, // Request ID get when user uses existing chanel info from db
          channelInformation.sessionId,
          channelInformation.projectId,
          channelInformation.prompt, //question--
          async (
            progressStatus,
            chatResponse,
            chainOfThought,
            isEndTurn,
            sessionName,
            promptId,
            fileContent,
            isAborted,
          ) => {
            if (chatResponse !== '') lastChatResponse = chatResponse;
            if (chainOfThought !== null) lastChainOfThought = chainOfThought;
            if (fileContent.length > 0) lastFileContent = fileContent;
            if (sessionName !== '') lastSessionName = sessionName;

            const _updatedSessionName = lastSessionName || channelInformation.sessionName;

            const sessionSummaryBlock = await this.createProjectSessionSummaryBlock(
              teamId,
              channelInformation,
              _updatedSessionName,
            );
            if (promptId) {
              sessionPromptId = promptId;
            }

            let msg = await this.generateUpdatedBlocks(
              progressStatus,
              lastChatResponse,
              lastChainOfThought,
              isEndTurn,
              isAborted,
            );
            // let abortedThreadTs = isAborted.split('-')[0];
            // console.log('abortedThreadTs', abortedThreadTs, threadTs);
            if (isAborted) {
              msg = msg.filter(
                block =>
                  !(block.type === 'section' && block.text?.type === 'mrkdwn' && block.text.text.includes(`🪄`)) &&
                  !(block.type === 'actions' && block.elements?.some(el => el.action_id === 'stop_button')),
              );

              await slackClient.chat.update({
                channel: channelId,
                ts: messageTimestamp,
                text: 'Working on it...',
                blocks: msg,
              });
              console.log('STOP');

              try {
                await slackClient.chat.postMessage({
                  channel: channelId,
                  text: 'Fetching Metadata...',
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `🛑 Analysis generation stopped`,
                      },
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `>${sessionSummaryBlock}`,
                      },
                    },
                  ],
                  //@ts-ignore
                  thread_ts: threadTs, // original msg timestamp that started thread
                });
              } catch (error) {
                console.log('Cannot post metadata------', error);
              }
              return;
            }

            await slackClient.chat.update({
              channel: channelId,
              ts: messageTimestamp,
              text: 'Working on it..',
              blocks: msg,
            });

            if (isEndTurn) {
              let userInfoBlock = [];
              const sessionSummaryBlock = await this.createProjectSessionSummaryBlock(
                teamId,
                channelInformation,
                _updatedSessionName,
              );
              console.log('lastFileContent--', lastFileContent);
              if (lastFileContent.length > 0) {
                for (const fileContent of lastFileContent) {
                  const fileRes = await this.downLoadFile(
                    fileContent,
                    messageTimestamp,
                    teamId,
                    channelId,
                    channelInformation.projectId,
                  );
                  if (!fileRes.status) {
                    userInfoBlock.push({
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: fileRes.message,
                      },
                    });
                  } else {
                    userInfoBlock.push(...msg);
                    userInfoBlock.push({
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: fileRes.message,
                      },
                    });
                  }
                }
                await slackClient.chat.update({
                  channel: channelId,
                  ts: messageTimestamp,
                  text: 'userinfoblock update..',
                  blocks: userInfoBlock,
                });
                setTimeout(() => {
                  try {
                    slackClient.chat.postMessage({
                      channel: channelId,
                      text: 'Fetching Metadata...',
                      blocks: [
                        {
                          type: 'section',
                          text: {
                            type: 'mrkdwn',
                            text: `>${sessionSummaryBlock}`,
                          },
                        },
                      ],
                      //@ts-ignore
                      thread_ts: threadTs, // original msg timestamp that started thread
                    });
                  } catch (error) {
                    console.log('Cannot post metadata------', error);
                  }
                }, 2000);
              } else {
                let linkText = '';
                if (sessionPromptId) {
                  const linkToWeb = generateUrl(
                    sessionPromptId,
                    channelInformation.projectId,
                    channelInformation.sessionId,
                    url,
                  );

                  linkText = `<${linkToWeb}|Visit Session>`;
                }
                userInfoBlock.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `:white_check_mark: Analysis Complete\n\n ${linkText}\n\n> ${sessionSummaryBlock}`,
                  },
                });

                try {
                  slackClient.chat.postMessage({
                    channel: channelId,
                    text: 'Fetching Metadata...',
                    blocks: userInfoBlock,
                    //@ts-ignore
                    thread_ts: threadTs, // original msg timestamp that started thread
                  });
                } catch (error) {
                  console.log('Cannot post metadata------', error);
                }
              }

              // TODO: WHY AGAIN
              const data = {
                teamId: teamId,
                channelId: channelId,
                projectId: channelInformation.projectId,
                sessionId: channelInformation.sessionId,
                projectName: channelInformation.projectName,
                sessionName: _updatedSessionName,
                requestId: channelInformation.requestId,
              };
              if (isSaveProjectMetaDataConfiguration) {
                console.log('saving in postgres');
                await this.masterService.saveChannelData(data, isDirectMessage);
              }
              //store subthread info also
              const updatedData = {
                ...data,
                threadId: threadTs, // Add threadId
              };
              await this.masterService.saveThreadData(updatedData, isDirectMessage);
            }
          },
          abortController.signal,
        )
        .then(async res => {})
        .catch(error => {
          this.logger.error('Error in getResponse:', error);
        });
    } catch (error) {
      this.logger.error('Catch Error in getResponse:', error);
    }
  }

  private generateGreetingBlocks(event: any) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Hello <@${event.user}>!* :wave: How can I help you today?`,
        },
      },
    ];
  }

  private async generateProjectDropdownBlocks(
    teamId,
    projects?: any[],
    selectedProjectId?: string,
    selectedProjectName?: string,
  ) {
    try {
      let _projects = [];
      if (projects.length == 0) {
        const projectsResponse = await this.fetchProjects(teamId);
        _projects = projectsResponse.projects;
      } else {
        _projects = projects;
      }
      // console.log('generateProjectDropdownBlocks', this.projectName, this.projectId);

      if (!_projects || _projects.length === 0) {
        console.warn('No projects available to generate dropdown.');
        return [
          {
            type: 'section',
            block_id: SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK,
            text: {
              type: 'mrkdwn',
              text: '*Project*',
            },
            accessory: {
              type: 'static_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select Project',
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'No Projects Available',
                    emoji: true,
                  },
                  value: 'NO_PROJECT',
                },
              ],
              action_id: SLACK_INPUT_ACTIONS.NO_ACTION_INPUT,
            },
          },
        ];
      }

      return [
        {
          type: 'section',
          block_id: SLACK_DROPDOWN_BLOCK_ID.SELECT_PROJECT_BLOCK,
          text: {
            type: 'mrkdwn',
            text: '*Project*',
          },
          accessory: {
            type: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select Project',
            },
            options: _projects.map(project => ({
              text: {
                type: 'plain_text',
                text: `${project?.name || 'Unnamed Project'}`,
                emoji: true,
              },
              value: project?.uuid,
            })),
            ...(selectedProjectName && selectedProjectId
              ? {
                  initial_option: {
                    text: {
                      type: 'plain_text',
                      text: `${selectedProjectName || 'Unnamed Project'}`,
                      emoji: true,
                    },
                    value: selectedProjectId,
                  },
                }
              : {}),
            action_id: SLACK_DROPDOWN_ACTIONS.PROJECT_SELECTION_DROPDOWN,
          },
        },
      ];
    } catch (error) {
      console.error('Error occurred in generateProjectDropdownBlocks:', error);
      return [];
    }
  }

  private async radioButtonsBlocks() {
    try {
      return [
        {
          type: 'section',
          block_id: 'radio_button_block',
          text: {
            type: 'mrkdwn',
            text: '*Session Type*',
          },
          accessory: {
            type: 'radio_buttons',
            options: SESSION_TYPE.map(_sessionType => ({
              text: {
                type: 'plain_text',
                text: _sessionType.label,
              },
              value: _sessionType.key,
            })),

            initial_option: {
              text: {
                type: 'plain_text',
                text: 'New Session',
              },
              value: SESSION_TYPE_KEYS.NEW_SESSION,
            },
            action_id: SLACK_DROPDOWN_ACTIONS.SESSION_TYPE_DROPDOWN,
          },
        },
      ];
    } catch (error) {
      console.error('Error generating New/Existing Radio Button:', error);
      return [];
    }
  }

  private async createSessionTypeRadioButtonsBlocks(sessionType?: string, reset = false) {
    try {
      const option = SESSION_TYPE.find(s => s.key === sessionType);
      if (!option) {
        console.error('No matching option found for:', sessionType);
        return [];
      }

      return [
        {
          type: 'section',
          block_id: reset ? 'radio_button_block' : SLACK_DROPDOWN_BLOCK_ID.SESSION_TYPE_BLOCK,
          text: {
            type: 'mrkdwn',
            text: '*Session Type*',
          },
          accessory: {
            type: 'radio_buttons',
            options: SESSION_TYPE.map(_sessionType => ({
              text: {
                type: 'plain_text',
                text: _sessionType.label,
              },
              value: _sessionType.key,
            })),

            initial_option: {
              text: {
                type: 'plain_text',
                text: option.label,
              },
              value: option.key,
            },
            action_id: SLACK_DROPDOWN_ACTIONS.SESSION_TYPE_DROPDOWN,
          },
        },
      ];
    } catch (error) {
      console.error('Error generating New/Existing Radio Button:', error);
      return [];
    }
  }

  private async showProjectSessionSelectionButton(slackClient, channelId, question) {
    console.log('showProjectSessionButton:>>');
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `Project and Session`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Select your Project and Session`,
          },
        },
        {
          type: 'actions',
          block_id: 'button_block',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Project and Session',
              },
              action_id: SLACK_BUTTONS_ACTIONS.SAVE_PROJECT_SESSION_DETAILS_BUTTON,
              value: JSON.stringify({
                question: question,
              }),
            },
          ],
        },
      ],
    });
  }

  private async showConfirmationMessage(
    slackClient: any,
    channelId: string,
    channelInformation: any,
    question: string,
  ) {
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `Still working on same project and session`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Still working on *Project*: ${channelInformation.projectName}, *Session*: ${channelInformation.sessionName}`,
          },
        },
        {
          type: 'actions',
          block_id: 'project_session_confirmation_button_block',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'No, Change Project/Session',
              },
              action_id: SLACK_BUTTONS_ACTIONS.CHANGE_PROJECT_SESSION_YES_BUTTON,
              value: JSON.stringify({
                question: question,
              }),
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Yes, Continue',
              },
              style: 'primary',
              action_id: SLACK_BUTTONS_ACTIONS.CHANGE_PROJECT_SESSION_NO_BUTTON,
              value: JSON.stringify({
                question: question,
              }),
            },
          ],
        },
      ],
    });
  }

  /*Project metadata append with every msg */
  private async createProjectSessionSummaryBlock(teamId, channelInformation, sessionName) {
    const systemDateTime = getSystemDateTime();

    const noOfConnections = await this.hawkeyeService.getProjectConnections(teamId, channelInformation.projectId);
    const connectionText = noOfConnections == 1 ? `${noOfConnections} Connection` : `${noOfConnections} Connections`;

    return `*Project*\n> ${
      channelInformation.projectName
    }\n>${connectionText}\n>\n> *Session*\n> ${sessionName?.trimEnd()}\n>\n> ${systemDateTime}`;
  }

  async downLoadFile(lastFileContent, messageTimestamp, teamId, channelId, projectId) {
    let response = {
      status: true,
      message: '',
    };

    try {
      this.logger.warn(`Log Details:
        Last file content :${lastFileContent}
        Message Timestamp: ${messageTimestamp}
        Team ID: ${teamId}
        Channel ID: ${channelId}
        Project ID: ${projectId}
    `);
      const parsedFileInfo = JSON.parse(lastFileContent);

      const {uuid, title, extension} = parsedFileInfo;
      const slackClient = await this.getSlackClient(teamId);
      const fileResponse = await this.hawkeyeService.fetchFileData(teamId, uuid, projectId);

      if (!fileResponse) {
        this.logger.warn('No file data from APi');
        response = {
          status: false,
          message: 'No Data',
        };
        return response;
      }

      const fileName = `${title}.${extension}`;
      const fileSize = fileResponse.length;

      const form = new FormData();
      // Convert ArrayBuffer to Blob
      const fileBlobData = new Blob([fileResponse], {type: 'application/pdf'});
      form.append('file', fileBlobData, fileName);

      const uploadUrlResponse = await slackClient.files.getUploadURLExternal({
        filename: fileName,
        length: fileSize,
      });
      const {upload_url: uploadUrl, file_id: fileId} = uploadUrlResponse;
      const uploadResult = await this.hawkeyeService.uploadFileToSlack(uploadUrl, form);

      if (!uploadResult) {
        this.logger.warn('Couldnot upload fileData');
        response = {
          status: false,
          message: 'No Data',
        };
        return response;
      }

      const completeUploadResponse = await slackClient.files.completeUploadExternal({
        files: [{id: fileId}],
        channel_id: channelId,
        thread_ts: messageTimestamp,
      });

      if (completeUploadResponse.ok) {
        this.logger.warn('Success');
        const fileUrlPrivate = completeUploadResponse.files[0].permalink;
        response = {
          status: true,
          message: `${fileName}`,
        };
        // <${fileUrlPrivate}|${fileName}>
        return response;
      }
    } catch (error) {
      console.error('Error during file upload:', error.response?.data || error.message);
      response = {
        status: false,
        message: 'Something went wrong in fetching file data',
      };
      return response;
    }
  }

  private async generateUpdatedBlocks(progressStatus, lastChatResponse, chainOfThought, isEndTurn, isAborted) {
    const blockToBeRendered = [];

    const allDesc = chainOfThought
      .map(cot => cot?.description)
      .filter(Boolean)
      .join('\n');

    if (allDesc) {
      const cotBlock = {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `>*Chain of Thought*\n>\n${allDesc
            .split('\n')
            .map(line => `>:brain: ${line}`)
            .join('\n')}`,
        },
      };

      blockToBeRendered.push(cotBlock);
    }

    if (!isEndTurn) {
      const status = extractProgressStatus(progressStatus);

      blockToBeRendered.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🪄  ${status}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Stop',
              },
              action_id: 'stop_button',
              style: 'danger',
            },
          ],
        },
      );
    }

    const MAX_TEXT_LENGTH = 3000;

    if (lastChatResponse) {
      let start = 0;

      while (start < lastChatResponse.length) {
        let end = Math.min(start + MAX_TEXT_LENGTH, lastChatResponse.length);

        if (end < lastChatResponse.length) {
          const lastNewline = lastChatResponse.lastIndexOf('\n', end);
          if (lastNewline > start) {
            end = lastNewline;
          }
        }

        const chunk = lastChatResponse.substring(start, end);

        // Process non-file chunks as usual
        blockToBeRendered.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: chunk,
          },
        });

        start = end + 1;
      }
    }

    return blockToBeRendered;
  }
}
