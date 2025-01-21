import {Exclude, Expose} from 'class-transformer';
import {ApiProperty} from '@nestjs/swagger';
import {IsOptional} from 'class-validator';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class GenericEntityDTO {
  @ApiProperty({description: 'id', type: Number, readOnly: true, example: 123})
  @Expose()
  @IsOptional()
  id: number;

  @ApiProperty({description: 'uid', type: String, example: 'example'})
  @Expose()
  @IsOptional()
  uid: string;

  @ApiProperty({description: 'requestId', type: String, readOnly: true, example: 'example'})
  @Expose()
  @IsOptional()
  requestId: string;

  @ApiProperty({description: 'version', type: Number, readOnly: true, example: 123})
  @Expose()
  @IsOptional()
  version: number;

  @ApiProperty({description: 'createdAt', type: Date, readOnly: true, example: '2023-01-31T17:26:04.804Z'})
  @Expose()
  @IsOptional()
  createdAt: Date;

  @ApiProperty({description: 'updatedAt', type: Date, readOnly: true, example: '2023-01-31T17:26:04.804Z'})
  @Expose()
  @IsOptional()
  updatedAt: Date;

  @ApiProperty({description: 'createdBy', type: Number, readOnly: true, example: 123})
  @Expose()
  @IsOptional()
  createdBy: number;

  @ApiProperty({description: 'updatedBy', type: Number, readOnly: true, example: 123})
  @Expose()
  @IsOptional()
  updatedBy: number;

  @ApiProperty({description: 'isActive', type: Boolean, readOnly: true, example: true})
  @Expose()
  @IsOptional()
  isActive: boolean;

  @ApiProperty({description: 'name', type: String, example: 'example'})
  @Expose()
  @IsOptional()
  name: string;

  @ApiProperty({description: 'payload', type: JSON})
  @Expose()
  @IsOptional()
  payload: object;

  @ApiProperty({description: 'createdByUserName', type: String, readOnly: true, example: 'example'})
  @Expose()
  @IsOptional()
  createdByUserName: string;

  @ApiProperty({description: 'updatedByUserName', type: String, readOnly: true, example: 'example'})
  @Expose()
  @IsOptional()
  updatedByUserName: string;
}
