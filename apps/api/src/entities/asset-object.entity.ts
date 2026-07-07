import type { FormValues } from '@tickets/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from './location.entity';
import { ObjectFamily } from './object-family.entity';

/** A tracked device/asset. */
@Entity('asset_objects')
export class AssetObject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '' })
  serialNo: string;

  @Column({ default: '' })
  inventoryNo: string;

  @Index()
  @Column({ type: 'uuid' })
  familyId: string;

  @ManyToOne(() => ObjectFamily)
  @JoinColumn({ name: 'familyId' })
  family: ObjectFamily;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  /** Values for the family's custom fields. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  fields: FormValues;

  /** Random slug embedded in the printable QR code. */
  @Index({ unique: true })
  @Column()
  qrToken: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
