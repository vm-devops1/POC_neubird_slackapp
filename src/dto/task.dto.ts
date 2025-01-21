import {ApiProperty} from '@nestjs/swagger';
import {Exclude, Expose} from 'class-transformer';
import {IsOptional, IsEmail} from 'class-validator';
import {TASK_STATUS} from 'src/util/task-status.enums';

@Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
export class TaskDTO {
  @ApiProperty({
    description: 'The id of the user',
    example: 'fdytet76frf732gt6fdrf36tgr7',
    readOnly: true,
    type: String,
  })
  @Expose()
  @IsOptional()
  uid?: string;

  @ApiProperty({
    description: 'the name of the task',
    example: 'Make a task entity',
    required: true,
    type: String,
  })
  @Expose()
  name?: string;

  @ApiProperty({
    description: 'description of the task',
    example: 'Create fields for task entity, add swagger properties to all the entity fields',
    type: String,
  })
  @Expose()
  @Exclude({toPlainOnly: true}) // toPlainOnly is important i.e. when DTO is converted to JSON response in controller
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'possible status for a task',
    enum: TASK_STATUS,
  })
  @Expose()
  @Exclude()
  @IsOptional()
  status?: TASK_STATUS;

  @ApiProperty({
    description: 'assignee of the task',
    example: 'abcd@email.com',
    required: true,
    type: String,
  })
  @Expose()
  @IsEmail({}, {message: 'a valid email address is needed'})
  assignee?: string;

  @ApiProperty({
    description: 'Due date for the task completion',
    example: '23-01-2023',
    type: Date,
    required: true,
  })
  @Expose()
  duedate?: Date;
}
