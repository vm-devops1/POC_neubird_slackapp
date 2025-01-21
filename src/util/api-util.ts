import {FunctionalException} from '@kaiju-lib/node-common';
import {HttpService} from '@nestjs/axios';
import {BadRequestException, Logger} from '@nestjs/common';
import {isArray} from 'class-validator';
import {catchError, firstValueFrom} from 'rxjs';

export class APIUtil {
  private static readonly logger = new Logger(APIUtil.name);

  static async post(
    httpService: HttpService,
    url: string,
    payload: any,
    tenantUid?: string,
    authorization?: string,
    xApiKey?: string,
    xValidationKey?: string,
    xExecuteForTenant?: string,
    extraHeaders?: {[key: string]: any}
  ): Promise<any> {
    const headers = {};
    if (!xExecuteForTenant && tenantUid && tenantUid !== '') headers['x-tenant-key'] = tenantUid;
    if (authorization) headers['authorization'] = authorization;
    if (xApiKey && xApiKey !== '') headers['x-api-key'] = xApiKey;
    if (xValidationKey && xValidationKey !== '') headers['x-validation-key'] = xValidationKey;
    if (xExecuteForTenant && xExecuteForTenant != '') headers['x-execute-for-tenant-key'] = xExecuteForTenant;
    if (extraHeaders) {
      for (const key of Object.keys(extraHeaders)) {
        headers[key] = extraHeaders[key];
      }
    }
    this.logger.debug('API Util url ' + url);
    const response = await firstValueFrom(
      httpService
        .post(url, payload, {
          headers,
        })
        .pipe(
          catchError(e => {
            let errorMessage = ['Bad Request'];
            this.logger.debug('Error in API Util ' + e?.errorMessage);
            if (e?.response?.data?.message) {
              let errorMessage = e?.response?.data?.message;
              if (!isArray(errorMessage)) {
                errorMessage = [errorMessage];
              }
              throw new FunctionalException(errorMessage);
            }
            if (e?.response?.data?.statusMessage) {
              let errorMessage = e?.response?.data?.statusMessage;
              if (!isArray(errorMessage)) {
                errorMessage = [errorMessage];
              }
              throw new FunctionalException(errorMessage);
            }
            if (e?.response?.data?.error) {
              let errorMessage = e?.response?.data?.error;
              if (!isArray(errorMessage)) {
                errorMessage = [errorMessage];
              }
              throw new FunctionalException(errorMessage);
            }

            throw new BadRequestException(errorMessage);
          }),
        ),
    );
    return response['data'];
  }

  static async get(
    httpService: HttpService,
    url: string,
    tenantUid?: string,
    authorization?: string,
    xApiKey?: string,
    xValidationKey?: string,
    xExecuteForTenant?: string,
  ): Promise<any> {
    const headers = {};
    if (!xExecuteForTenant && tenantUid && tenantUid !== '') headers['x-tenant-key'] = tenantUid;
    if (authorization) headers['authorization'] = authorization;
    if (xApiKey && xApiKey !== '') headers['x-api-key'] = xApiKey;
    if (xValidationKey && xValidationKey !== '') headers['x-validation-key'] = xValidationKey;
    if (xExecuteForTenant && xExecuteForTenant != '') headers['x-execute-for-tenant-key'] = xExecuteForTenant;

    this.logger.debug('API Util url ' + url);

    const response = await firstValueFrom(
      httpService
        .get(url, {
          headers,
        })
        .pipe(
          catchError(e => {
            let errorMessage = 'Bad Request';
            this.logger.debug('Error in API Util ' + e?.errorMessage);

            if (e?.response?.data?.message) {
              let errorMessage = e?.response?.data?.message;
              if (!isArray(errorMessage)) {
                errorMessage = [errorMessage];
              }
              throw new FunctionalException([errorMessage]);
            }
            throw new BadRequestException([errorMessage]);
          }),
        ),
    );
    return response['data'];
  }

  static async delete(
    httpService: HttpService,
    url: string,
    tenantUid?: string,
    authorization?: string,
    xValidationKey?: string,
    xExecuteForTenant?: string,
  ): Promise<any> {
    const headers = {};
    if (!xExecuteForTenant && tenantUid && tenantUid !== '') headers['x-tenant-key'] = tenantUid;
    if (authorization) headers['authorization'] = authorization;
    if (xValidationKey && xValidationKey !== '') headers['x-validation-key'] = xValidationKey;
    if (xExecuteForTenant && xExecuteForTenant != '') headers['x-execute-for-tenant-key'] = xExecuteForTenant;

    this.logger.debug('API Util url ' + url);

    const response = await firstValueFrom(
      httpService
        .delete(url, {
          headers,
        })
        .pipe(
          catchError(e => {
            let errorMessage = 'Bad Request';
            this.logger.debug('Error in API Util ' + e?.errorMessage);

            if (e?.response?.data?.message) {
              let errorMessage = e?.response?.data?.message;
              if (!isArray(errorMessage)) {
                errorMessage = [errorMessage];
              }
              throw new FunctionalException([errorMessage]);
            }
            throw new BadRequestException([errorMessage]);
          }),
        ),
    );
    return response['data'];
  }

  static async put(
    httpService: HttpService,
    url: string,
    payload: any,
    tenantUid?: string,
    authorization?: string,
    xApiKey?: string,
    xValidationKey?: string,
    xExecuteForTenant?: string,
  ): Promise<any> {
    const headers = {};
    if (!xExecuteForTenant && tenantUid && tenantUid !== '') headers['x-tenant-key'] = tenantUid;
    if (authorization) headers['authorization'] = authorization;
    if (xApiKey && xApiKey !== '') headers['x-api-key'] = xApiKey;
    if (xValidationKey && xValidationKey !== '') headers['x-validation-key'] = xValidationKey;
    if (xExecuteForTenant && xExecuteForTenant != '') headers['x-execute-for-tenant-key'] = xExecuteForTenant;

    this.logger.debug('API Util url ' + url);

    const response = await firstValueFrom(
      httpService
        .put(url, payload, {
          headers,
        })
        .pipe(
          catchError(e => {
            let errorMessage = 'Bad Request';
            this.logger.debug('Error in API Util ' + e?.errorMessage);

            if (e?.response?.data?.message) {
              let errorMessage = e?.response?.data?.message;
              if (!isArray(errorMessage)) {
                errorMessage = [errorMessage];
              }
              throw new FunctionalException([errorMessage]);
            }
            throw new BadRequestException([errorMessage]);
          }),
        ),
    );
    return response['data'];
  }

  static async sendEmail(
    httpService: HttpService,
    url: string,
    email: string,
    tenantUid: string,
    liquidVariables: any,
  ) {
    await firstValueFrom(
      httpService.post(
        url,
        {
          toEmail: email,
          liquidVariableValue: liquidVariables,
        },
        {
          headers: {
            'x-tenant-key': tenantUid,
            'x-validation-key': process.env.AUTH_SECURE_API_KEY,
          },
        },
      ),
    );
  }
}
