import {ApiProperty} from '@nestjs/swagger';
import {Exclude, Expose} from 'class-transformer';
import {IsOptional} from 'class-validator';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class PincodeDTO {
  @ApiProperty({
    description: 'the uid of the pincode',
    example: 'fdytet76frf732gt6fdrf36tgr7',
    readOnly: true,
    type: String,
  })
  @Expose()
  @IsOptional()
  uid?: string;

  @ApiProperty({
    description: 'the country of the pincode',
    example: 'India',
    required: true,
    type: String,
  })
  @Expose()
  country?: string;

  @ApiProperty({
    description: 'the state of the pincode',
    example: 'Karnataka',
    required: true,
    type: String,
  })
  @Expose()
  @Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
  state?: string;

  @ApiProperty({
    description: 'the city of the pincode',
    example: 'Bangalore',
    required: true,
    type: String,
  })
  @Expose()
  @Exclude({toPlainOnly: true})
  city?: string;

  @ApiProperty({
    description: 'the pincode',
    example: 560068,
    required: true,
    type: Number,
  })
  @Expose()
  pinCode?: number;
}
