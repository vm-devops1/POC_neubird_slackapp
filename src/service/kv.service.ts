import {Cacheable, CacheClear} from '@kaiju-lib/cache-manager';
import {Injectable} from '@nestjs/common';

@Injectable()
export class KVService {
  @Cacheable({
    cacheKey: args => args[0],
  })
  async getSet(key: string, value?: any): Promise<string> {
    console.log('Setting key:', key, 'value:', value);
    return value;
  }

  @CacheClear({
    cacheKey: args => args[0],
  })
  async clear(key: string): Promise<string> {
    return 'Ok';
  }
}
