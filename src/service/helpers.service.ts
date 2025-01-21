import {Log} from '@kaiju-lib/node-common';
import {Injectable} from '@nestjs/common';

@Injectable()
export class HelperService {
  @Log()
  async preparePrivateMetadata(object: any) {
    return JSON.stringify({...object});
  }
}
