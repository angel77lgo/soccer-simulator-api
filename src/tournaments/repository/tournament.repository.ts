import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tournament, TournamentDocument } from '../model/tournament.schema';
import { toObjectId } from '../../common/objectid.util';

@Injectable()
export class TournamentRepository {
  constructor(
    @InjectModel(Tournament.name)
    private readonly model: Model<TournamentDocument>,
  ) {}

  async find(options: { where?: any } = {}): Promise<TournamentDocument[]> {
    return this.model.find(options.where || {}).exec();
  }

  async findOne(options: { where: any }): Promise<TournamentDocument | null> {
    return this.model.findOne(options.where).exec();
  }

  async findById(id: string): Promise<TournamentDocument | null> {
    return this.model.findById(toObjectId(id)).exec();
  }

  create(data: Partial<Tournament>): TournamentDocument {
    return new this.model(data);
  }

  async save<T extends TournamentDocument | TournamentDocument[]>(
    entityOrEntities: T,
  ): Promise<T> {
    if (Array.isArray(entityOrEntities)) {
      const saved = await Promise.all(
        entityOrEntities.map(async (e) => e.save()),
      );
      return saved as any;
    } else {
      return (entityOrEntities as any).save();
    }
  }

  async update(id: string, data: Partial<Tournament>): Promise<void> {
    await this.model.updateOne({ _id: toObjectId(id) }, { $set: data }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: toObjectId(id) }).exec();
  }
}
