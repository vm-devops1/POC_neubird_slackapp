import {HttpService} from '@nestjs/axios';
import {forwardRef, Inject, Injectable} from '@nestjs/common';
import axios from 'axios';
import {firstValueFrom} from 'rxjs';
import {MasterDataService} from 'src/service/masterdata.service';
import {MessageContentType} from 'src/util/constant';
import {convertStringArrayToObjectArray, removeHTML, separateTextAndFiles} from 'src/util/util';
import {v4 as uuidv4} from 'uuid';
@Injectable()
export class HawkeyeService {
  @Inject(forwardRef(() => HttpService))
  private readonly httpService: HttpService;

  @Inject(forwardRef(() => MasterDataService))
  private readonly masterService: MasterDataService;

  async fetchProjects(teamId: string) {
    // console.log('fetchProjects:>>');

    try {
      const {url, apiKey} = await this.masterService.getConfig(teamId);

      if (!url || !apiKey) {
        //TODO: handle this
        throw new Error(`Invalid configuration for teamId: ${teamId}`);
      }

      const baseURL = `${url}/api/v1/project?system_project_type=SYSTEM_PROJECT_TYPE_UNSPECIFIED`;

      const headers = {
        Authorization: `Bearer ${apiKey}`,
      };

      const response = await firstValueFrom(this.httpService.get(baseURL, {headers}));

      const {status, data} = response;
      // console.log('Response status:', status);

      if (status === 200) {
        const requestId = data?.response?.request_id;
        const _projects = data?.specs || [];
        const projects = _projects.filter(project => project.project_state === 'PROJECT_STATE_READY');

        return {requestId, projects};
      } else {
        console.error(`Unexpected status code: ${status}`);
        return false;
      }
    } catch (error) {
      if (error.response) {
        const {status, data} = error.response;
        console.error('API Error:', status, data);
      } else if (error.request) {
        console.error('No response received from server:', error.request);
      } else {
        console.error('Error occurred:', error.message);
      }
      return false;
    }
  }

  async fetchAllExistingSessions(requestId: string, teamId: string, projectId: string) {
    try {
      console.log('fetchAllExistingSessions called--');
      const {url, apiKey} = await this.masterService.getConfig(teamId);
      const baseURL = `${url}/api/v1/inference/session/list`;

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };

      const body = {
        request: {request_id: requestId},
        organization_uuid: 'ORGANIZATION_NAME_ROOT',
        project_uuid: projectId,
        pagination: {
          filter: {
            key: null,
            value: null,
            operator: null,
          },
          sort: {
            field: null,
            ascending: true,
          },
          start: 0,
          limit: 0,
        },
      };

      const allSessionsResponse = await axios.post(baseURL, body, {headers});
      let sessionsList = [];

      //TODO:confirm
      if (allSessionsResponse.status === 200) {
        sessionsList = allSessionsResponse?.data?.sessions || [];
        console.log('Fetched Sessions:', sessionsList.length);
      }

      //TODO:fetch only 10 item??
      return sessionsList.slice(0, 10);
    } catch (error) {
      console.error('Error in fetchAllExistingSessions:', error.message || error);
      return [];
    }
  }

  //TODO:change here
  async getNewSessionId(projectId: string, requestId: string, teamId: string) {
    console.log('getNewSessionId :>>');
    try {
      const {url, apiKey} = await this.masterService.getConfig(teamId);
      const baseURL = url + '/api/v1/inference/new_session';

      const response = await axios.post(
        baseURL,
        {
          filter_chain: null,
          gendb_spec: {
            embedding_device: null,
            embedding_provider: null,
            llm_model: null,
            llm_provider: null,
            rael_config: null,
            session_store: null,
            uuid: uuidv4(),
            vectorstore_persist_directory: null,
            vectorstore_provider: null,
          },
          organization_uuid: 'ORGANIZATION_NAME_ROOT',
          project_uuid: projectId,
          request: {request_id: requestId},
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );
      console.log('Creating new session', response.data);
      return response.status === 200 ? response.data.session_uuid : '';
    } catch (error) {
      console.log('Error in getNewSessionId :>>', error);
    }
  }
  async getListOfUsers(_config: any, teamId: string) {
    const config = await this.masterService.getConfig(teamId);
    const baseURL = _config.url ? _config.url : config.url;
    const url = baseURL + '/api/v1/user';
    const headers = {
      Authorization: _config.apiKey ? 'Bearer ' + _config.apiKey : 'Bearer ' + config.apiKey,
    };
    const response = await firstValueFrom(this.httpService.get(url, {headers}));
    return response.data;
  }

  async getSessionResponse(
    threadTs,
    teamId,
    requestId,
    sessionId,
    projectId,
    question,
    onUpdate,
    abortSignal: AbortSignal,
  ) {
    const {url, apiKey} = await this.masterService.getConfig(teamId);
    const baseURL = `${url}/api/v1/inference/session`;
    console.log(baseURL, apiKey, teamId, requestId, sessionId, projectId);

    const requestBody = JSON.stringify({
      request: {request_id: requestId},
      session_uuid: sessionId,
      project_uuid: projectId,
      messages: [
        {
          content: {
            content_type: 'CONTENT_TYPE_CHAT_PROMPT',
            parts: [question],
          },
        },
      ],
      action: 'ACTION_NEXT',
    });

    const response = await fetch(baseURL, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // We get a ReadableStream of data, which we need to read chunk by chunk.
    const reader = response.body.getReader();
    let buffer = '';
    let progressStatus = '';
    let chatResponse = '';
    let fileContent = [];
    let chainOfThought = [];
    let sessionName = '';

    // Continuously read from the stream until it's complete
    while (true) {
      const {value, done} = await reader.read();
      if (done) {
        break;
      }

      // Convert the chunk (Uint8Array) to a string
      const chunk = new TextDecoder().decode(value);
      buffer += chunk;

      // Split on double newlines to separate events
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        // Extract the full event
        const eventString = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        // Process the event string
        const processedChunk = this.processEvent(eventString);
        const parsedChunk = JSON.parse(processedChunk);
        // console.log('parsedChunk :>> ', parsedChunk);
        const contentType = parsedChunk?.message?.content?.content_type;
        const promptId = parsedChunk?.message?.id ?? '';
        const parts = parsedChunk?.message?.content?.parts;

        const content = parsedChunk?.message?.content?.parts?.[0];
        const hasError = !!(parsedChunk?.error || parsedChunk?.response?.error_message);
        const isEndTurn = parsedChunk?.message?.end_turn || parsedChunk?.message?.status === 'STATUS_DONE';
        const isStreamingCompleted = parsedChunk?.message?.status === 'STATUS_DONE';

        if (abortSignal.aborted) {
          console.log('Streaming aborted.');
          onUpdate(
            progressStatus,
            chatResponse,
            chainOfThought,
            isEndTurn,
            sessionName,
            promptId,
            fileContent,
            threadTs,
          );

          return; // Exit the function if the process is aborted
        }
        if (isStreamingCompleted) {
          if (onUpdate)
            onUpdate(progressStatus, chatResponse, chainOfThought, isEndTurn, sessionName, promptId, fileContent, '');
          break;
        }

        if (hasError) {
          console.log('Encountered an error while processing the message.');
        } else {
          if (contentType === MessageContentType.CONTENT_TYPE_PROGRESS_STATUS) {
            progressStatus = content ?? '';
            // Continuously return the progress status
            if (onUpdate)
              onUpdate(progressStatus, chatResponse, chainOfThought, isEndTurn, sessionName, promptId, fileContent, '');
          } else if (contentType === MessageContentType.CONTENT_TYPE_CHAT_RESPONSE) {
            const chatRes = content ? removeHTML(content) : '';
            const {text: chatResponse = '', files: fileContent = []} = chatRes ? separateTextAndFiles(chatRes) : {};

            if (onUpdate)
              onUpdate(progressStatus, chatResponse, chainOfThought, isEndTurn, sessionName, promptId, fileContent, '');
          } else if (contentType === MessageContentType.CONTENT_TYPE_CHAIN_OF_THOUGHT) {
            const currCoT = convertStringArrayToObjectArray(parts) ?? [];
            chainOfThought = [...currCoT];
            if (onUpdate)
              onUpdate(progressStatus, chatResponse, chainOfThought, isEndTurn, sessionName, promptId, fileContent, '');
          } else if (contentType === MessageContentType.CONTENT_TYPE_SESSION_NAME) {
            sessionName = content.trimEnd();
            if (onUpdate)
              onUpdate(progressStatus, chatResponse, chainOfThought, isEndTurn, sessionName, promptId, fileContent, '');
          }
        }
      }
    }

    return true;
  }

  // Move this to helper service
  processEvent(eventString) {
    let eventName = 'message';
    let data = '';

    const lines = eventString.split('\n');
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.replace('event:', '').trim();
      } else if (line.startsWith('data:')) {
        data += line.replace('data:', '').trim();
      }
    }

    return data;
  }

  async getProjectConnections(teamId: string, projectId: string) {
    try {
      const {url, apiKey} = await this.masterService.getConfig(teamId);
      const baseURL = `${url}/api/v1/connection?project_uuid=${projectId}`;
      const headers = {
        Authorization: 'Bearer ' + apiKey,
      };
      const response = await firstValueFrom(this.httpService.get(baseURL, {headers}));

      const {status, data} = response;
      // console.log('Data here:', data);
      if (status === 200) {
        return data?.specs?.length || 0;
      } else {
        console.error(`Unexpected status code: ${status}`);
        return 0;
      }
      // return response.data;
    } catch (error) {
      console.log('Error occured in getProjectConnections :>>', error);
      return 0;
    }
  }

  async fetchFileData(teamId: string, uuid: string, projectId: string) {
    try {
      const {url, apiKey} = await this.masterService.getConfig(teamId);
      const baseURL = `${url}/api/v1/visualization/${uuid}?project_uuid=${projectId}`;

      const response = await axios.get(baseURL, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        responseType: 'arraybuffer', // Fetch as raw binary data
      });
      // const response = await firstValueFrom(this.httpService.get(baseURL, {headers}));

      const {status, data} = response;
      console.log('Response status:', status);

      if (status === 200) {
        return data;
      } else {
        console.error(`Unexpected status code: ${status}`);
        return false;
      }
    } catch (error) {
      console.log('Error occured in getProjectConnections :>>', error);
      return false;
    }
  }
  async uploadFileToSlack(uploadUrl, form) {
    try {
      // Perform the POST request to upload the file
      const response = await axios.post(uploadUrl, form, {
        headers: {
          'Content-Type': 'multipart/form-data', // Explicitly set Content-Type for FormData
        },
      });

      return true;
    } catch (error) {
      console.error('Error during file upload:', error.response?.data || error.message);
      return false;
    }
  }
}
