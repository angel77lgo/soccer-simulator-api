import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
export class ConfederationInfo {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  code: string;
}

export type NationalTeamDocument = NationalTeam & Document;

@Schema({ collection: 'national_teams', timestamps: true })
export class NationalTeam extends Document {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: String, required: true })
  shortName: string;

  @Prop({ type: String, required: true, unique: true })
  fifaCode: string;

  @Prop({ type: String, required: false })
  flagUrl?: string;

  @Prop({ type: ConfederationInfo, required: true })
  confederation: ConfederationInfo;

  @Prop({ type: Number, required: true })
  fifaRanking: number;

  @Prop({ type: Number, required: true })
  simulationRating: number;

  @Prop({ type: Number, default: 0 })
  matchesPlayed: number;

  @Prop({ type: Number, default: 0 })
  wins: number;

  @Prop({ type: Number, default: 0 })
  draws: number;

  @Prop({ type: Number, default: 0 })
  losses: number;

  @Prop({ type: Number, default: 0 })
  goalsFor: number;

  @Prop({ type: Number, default: 0 })
  goalsAgainst: number;

  @Prop({ type: Number, default: 0 })
  internationalTitles: number;
}

export const NationalTeamSchema = SchemaFactory.createForClass(NationalTeam);
