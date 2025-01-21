import {ApiProperty} from '@nestjs/swagger';
import {Exclude, Expose} from 'class-transformer';
import {IsOptional} from 'class-validator';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class SlackConfigDTO {
  @ApiProperty({description: 'id', type: Number, readOnly: true, example: 123})
  @Expose()
  @IsOptional()
  id: number;

  @ApiProperty({description: 'key', type: String, example: 'example'})
  @Expose()
  @IsOptional()
  key: string;

  @ApiProperty({description: 'value', type: String, example: 'example'})
  @Expose()
  @IsOptional()
  value: string;
}
