import {BaseSqlEntity} from '@kaiju-lib/node-common';
import {Expose} from 'class-transformer';
import {Column, Entity, PrimaryGeneratedColumn, Unique} from 'typeorm';

@Entity('slack_config')
@Unique(['key'])
export class SlackConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Expose()
  @Column({name: 'key'})
  key: string;

  @Expose()
  @Column({name: 'value'})
  value: string;
}
