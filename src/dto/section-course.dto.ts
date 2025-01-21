import {Exclude, Expose} from 'class-transformer';
import {IsOptional, IsString} from 'class-validator';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class SectionCourseDTO {
  @Expose()
  @IsOptional()
  tenantId?: string;

  @Expose()
  @IsOptional()
  tenantUid?: string;

  @Expose()
  @IsOptional()
  sectionUid?: string;

  @Expose()
  @IsOptional()
  @IsString()
  sectionTitle?: string;

  @Expose()
  @IsString()
  courseUid?: string;

  @Expose()
  @IsOptional()
  @IsString()
  courseName?: string;
}
