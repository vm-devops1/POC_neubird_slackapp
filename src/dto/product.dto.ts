import {Exclude, Expose} from 'class-transformer';
import {ApiProperty} from '@nestjs/swagger';
import {IsOptional} from 'class-validator';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class ProductDTO {
  @ApiProperty({description: 'name', type: String, example: 'add your example'})
  @Expose()
  @IsOptional()
  name: string;

  @ApiProperty({description: 'description', type: String, example: 'add your example'})
  @Expose()
  @IsOptional()
  description: string;

  @ApiProperty({description: 'price', type: Number, example: 'add your example'})
  @Expose()
  @IsOptional()
  price: number;

  @ApiProperty({description: 'imageURL', type: String, example: 'add your example'})
  @Expose()
  @IsOptional()
  imageURL: string;

  @ApiProperty({description: 'thumbnailURL', type: String, example: 'add your example'})
  @Expose()
  @IsOptional()
  thumbnailURL: string;

  @ApiProperty({description: 'attributesJSON', type: String, example: 'add your example'})
  @Expose()
  @IsOptional()
  attributesJSON: string;

  // default
  @ApiProperty({description: 'description', type: Number, readOnly: true, example: 12})
  @Expose()
  @IsOptional()
  id: number;

  @ApiProperty({description: 'description', type: String, example: 'xxxxx-xxxxxx-xxxxx'})
  @Expose()
  @IsOptional()
  uid: string;

  @ApiProperty({description: 'description', type: Date, readOnly: true, example: '2023-01-20'})
  @Expose()
  @IsOptional()
  createdAt: Date;

  @ApiProperty({description: 'description', type: Date, readOnly: true, example: '2023-01-20'})
  @Expose()
  @IsOptional()
  updatedAt: Date;

  @ApiProperty({description: 'description', type: Number, readOnly: true, example: 122})
  @Expose()
  @IsOptional()
  createdBy: number;

  @ApiProperty({description: 'description', type: Number, readOnly: true, example: 122})
  @Expose()
  @IsOptional()
  updatedBy: number;

  @ApiProperty({description: 'description', type: Boolean, readOnly: true, example: true})
  @Expose()
  @IsOptional()
  isActive: boolean;
}
