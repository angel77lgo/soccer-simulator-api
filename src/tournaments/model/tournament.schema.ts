import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MatchPhase =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter'
  | 'semi'
  | 'third_place'
  | 'final';

export type TournamentStatus =
  | 'pending'
  | 'group_stage'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter'
  | 'semi'
  | 'third_place'
  | 'final'
  | 'finished';

@Schema()
export class Match {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  _id: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  homeTeamId: string;

  @Prop({ type: String, required: true })
  awayTeamId: string;

  @Prop({ type: Number, default: 0 })
  homeScore: number;

  @Prop({ type: Number, default: 0 })
  awayScore: number;

  @Prop({ type: Number, default: 0 })
  homeExtraScore: number;

  @Prop({ type: Number, default: 0 })
  awayExtraScore: number;

  @Prop({ type: Number, default: 0 })
  homePenaltyScore: number;

  @Prop({ type: Number, default: 0 })
  awayPenaltyScore: number;

  @Prop({ type: String, default: 'pending' })
  status: string;

  @Prop({ type: String, default: null })
  winnerId: string | null;

  @Prop({ type: String, default: null })
  loserId: string | null;

  @Prop({ type: String, required: true })
  phase: MatchPhase;

  @Prop({ type: Number, default: null })
  bracketPosition: number | null;
}

export const MatchSchema = SchemaFactory.createForClass(Match);

@Schema()
export class GroupStanding {
  @Prop({ type: String, required: true })
  teamId: string;

  @Prop({ type: String, required: true })
  confederation: string;

  @Prop({ type: Number, default: 0 })
  points: number;

  @Prop({ type: Number, default: 0 })
  played: number;

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
  goalDiff: number;

  @Prop({ type: Number, default: 0 })
  fairPlayPoints: number;

  @Prop({ type: Number, default: 0 })
  position: number;
}

export const GroupStandingSchema = SchemaFactory.createForClass(GroupStanding);

@Schema()
export class Group {
  @Prop({ type: MongooseSchema.Types.ObjectId, auto: true })
  _id: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  identifier: string; // e.g. "A", "B", ...

  @Prop({ type: [GroupStandingSchema], default: [] })
  standings: GroupStanding[];

  @Prop({ type: [MatchSchema], default: [] })
  matches: Match[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);

@Schema()
export class KnockoutStage {
  @Prop({ type: [MatchSchema], default: [] })
  round32: Match[];

  @Prop({ type: [MatchSchema], default: [] })
  round16: Match[];

  @Prop({ type: [MatchSchema], default: [] })
  quarterfinals: Match[];

  @Prop({ type: [MatchSchema], default: [] })
  semifinals: Match[];

  @Prop({ type: MatchSchema, default: null })
  thirdPlace: Match | null;

  @Prop({ type: MatchSchema, default: null })
  final: Match | null;
}

export type TournamentDocument = Tournament & Document;

@Schema({ collection: 'tournaments', timestamps: true })
export class Tournament {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true })
  groupStageSize: number;

  @Prop({ type: String, required: true })
  format: string; // e.g. "eurocup"

  @Prop({ type: [MongooseSchema.Types.ObjectId], required: true })
  teamsIds: MongooseSchema.Types.ObjectId[] | any;

  @Prop({ type: String, default: 'pending' })
  status: TournamentStatus;

  @Prop({ type: [GroupSchema], default: [] })
  groups: Group[];

  @Prop({ type: KnockoutStage, default: () => ({}) })
  knockoutStage: KnockoutStage;
}

export const TournamentSchema = SchemaFactory.createForClass(Tournament);
