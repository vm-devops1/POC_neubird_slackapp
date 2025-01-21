import {instanceToPlain, plainToClass, plainToClassFromExist} from 'class-transformer';
import {isEmpty} from 'class-validator';

/**
 * Copy properties from Entity to DTO or DTO to Entity
 * @param source
 * @param cls
 * @param target
 * @returns
 */
export function copyProperties<T>(source: object, cls: new () => T, target?: T): T {
  if (isEmpty(target)) {
    target = new cls();
  }
  // copy to existing object
  target = plainToClassFromExist(target, source, {excludeExtraneousValues: true, exposeUnsetFields: false});
  // ensure type conversions are properly done
  target = plainToClass(cls, target, {excludeExtraneousValues: true, exposeUnsetFields: false});
  return target;
}

/**
 * Serialize Response
 * @param source
 * @param cls
 * @param target
 * @returns
 */
export function serialize<T>(source: T): Record<string, any> {
  if (isEmpty(source)) {
    return {};
  }
  // copy to existing object
  return instanceToPlain(source);
}
