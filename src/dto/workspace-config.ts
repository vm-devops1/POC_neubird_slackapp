import {ApiProperty} from '@nestjs/swagger';
import {Exclude, Expose} from 'class-transformer';
import {IsOptional} from 'class-validator';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class WorkspaceConfigDTO {
  @ApiProperty({description: 'id', type: Number, readOnly: true, example: 123})
  @Expose()
  @IsOptional()
  workspaceId: number;

  @ApiProperty({description: 'uid', type: String, example: 'example'})
  @Expose()
  @IsOptional()
  workspaceName: string;

  @ApiProperty({description: 'requestId', type: String, readOnly: true, example: 'example'})
  @Expose()
  @IsOptional()
  baseURL: string;

  @ApiProperty({description: 'version', type: Number, readOnly: true, example: 123})
  @Expose()
  @IsOptional()
  apiKey: number;

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
}
