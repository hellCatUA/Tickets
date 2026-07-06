import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Per-year atomic counter behind T-YYYY-NNNN ticket numbers. */
@Entity('ticket_counters')
export class TicketCounter {
  @PrimaryColumn()
  year: number;

  @Column()
  seq: number;
}
