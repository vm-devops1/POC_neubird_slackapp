import {Exclude, Expose} from 'class-transformer';
import {IsOptional, IsString} from 'class-validator';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class SectionCourseAggregationDTO {
  @Expose()
  @IsOptional()
  tenantId?: string;

  @Expose()
  @IsOptional()
  tenantUid?: string;

  @Expose()
  @IsOptional()
  count?: number;

  @Expose()
  @IsOptional()
  @IsString()
  courseName?: string;
}
